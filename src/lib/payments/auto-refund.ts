/**
 * Auto-refund for unsupported jurisdictions — server-only.
 *
 * When a user pays for a deposit case in an unsupported state,
 * automatically triggers a refund via the Paddle API and closes
 * the case.
 *
 * Per payment-billing-rules.md: unsupported-jurisdiction auto-refund
 * should be immediate and include a clear explanation.
 */

import { workerConvex, api } from '@/lib/convex/worker-client';
import type { Id } from '@convex/dataModel';
import { DEPOSIT_JURISDICTION, type DepositJurisdiction } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AutoRefundResult {
  refunded: boolean;
  reason?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Paddle refund API                                                 */
/* ------------------------------------------------------------------ */

async function requestPaddleRefund(
  transactionId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Paddle API key not configured' };
  }

  const baseUrl = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  try {
    const response = await fetch(
      `${baseUrl}/transactions/${transactionId}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          type: 'full',
        }),
      },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: { message?: string } };
      return {
        ok: false,
        error: data.error?.message ?? `Paddle API error: ${response.status}`,
      };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Refund request failed: ${message}` };
  }
}

/* ------------------------------------------------------------------ */
/*  Main function                                                     */
/* ------------------------------------------------------------------ */

/**
 * Checks if a case needs an auto-refund (unsupported jurisdiction)
 * and processes it if so.
 *
 * Call this after a transaction.completed webhook for deposit cases.
 */
export async function processAutoRefundIfNeeded(
  caseId: string,
  transactionId: string,
): Promise<AutoRefundResult> {
  // Load case (trusted service context)
  const caseRow = await workerConvex.query(api.service.getCase, {
    caseId: caseId as Id<'cases'>,
  });

  if (!caseRow) {
    return { refunded: false, error: `Case ${caseId} not found` };
  }

  // Only check deposit cases
  if (caseRow.wedge !== 'deposit') {
    return { refunded: false };
  }

  // Check if jurisdiction is supported
  const isSupported = DEPOSIT_JURISDICTION.includes(
    caseRow.jurisdiction as DepositJurisdiction,
  );

  if (isSupported) {
    return { refunded: false };
  }

  // Unsupported jurisdiction — trigger refund
  const reason = `Automatic refund: jurisdiction ${caseRow.jurisdiction} is not supported for deposit cases. Supported states: ${DEPOSIT_JURISDICTION.join(', ')}.`;

  const refundResult = await requestPaddleRefund(transactionId, reason);

  if (!refundResult.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[AutoRefund] Failed to refund transaction ${transactionId}:`,
      refundResult.error,
    );
    return { refunded: false, error: refundResult.error };
  }

  // Update case → refunded + closed (records status history).
  await workerConvex.mutation(api.service.setPaymentStatus, {
    caseId: caseId as Id<'cases'>,
    paymentStatus: 'refunded',
    newStatus: 'closed',
  });

  // eslint-disable-next-line no-console
  console.log(
    `[AutoRefund] Refunded transaction ${transactionId} for case ${caseId} (unsupported jurisdiction: ${caseRow.jurisdiction})`,
  );

  return { refunded: true, reason };
}
