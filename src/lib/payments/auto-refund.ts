/**
 * Auto-refund for unsupported jurisdictions — server-only.
 *
 * When a user pays for a deposit case in an unsupported state,
 * automatically triggers a refund via the Polar API and closes
 * the case.
 *
 * Per payment-billing-rules.md: unsupported-jurisdiction auto-refund
 * should be immediate and include a clear explanation.
 */

import { workerConvex, api } from '@/lib/convex/worker-client';
import type { Id } from '@convex/dataModel';
import { getPolar } from '@/lib/payments/polar-client';
import { cancelOutcomeEmails } from '@/lib/outcomes/outcome-scheduler';
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
/*  Polar refund API                                                  */
/* ------------------------------------------------------------------ */

/**
 * Issues a full Polar refund for an order. Polar's `refunds.create` requires an
 * explicit `amount` (integer cents), so we look up the order first and refund
 * its still-refundable amount. `comment` carries our human-readable reason;
 * `reason` is the fixed enum value Polar expects.
 */
async function requestPolarRefund(
  orderId: string,
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return { ok: false, error: 'Polar access token not configured' };
  }

  try {
    const polar = getPolar();

    // Look up the refundable amount (integer cents). `refundableAmount` accounts
    // for prior refunds and applied balance; fall back to totalAmount.
    const order = await polar.orders.get({ id: orderId });
    const amount = order.refundableAmount || order.totalAmount;
    if (!amount || amount <= 0) {
      return { ok: false, error: `Order ${orderId} has no refundable amount` };
    }

    await polar.refunds.create({
      orderId,
      amount,
      reason: 'customer_request',
      comment,
      revokeBenefits: true,
    });

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
 * Call this after an order.paid webhook for deposit cases. `orderId` is the
 * Polar order id (stored on the case as polar_order_id).
 */
export async function processAutoRefundIfNeeded(
  caseId: string,
  orderId: string,
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

  const refundResult = await requestPolarRefund(orderId, reason);

  if (!refundResult.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[AutoRefund] Failed to refund order ${orderId}:`,
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

  // R-2: cancel any scheduled outcome-follow-up emails for the now-closed case.
  try {
    await cancelOutcomeEmails(caseId);
  } catch {
    // best-effort
  }

  // eslint-disable-next-line no-console
  console.log(
    `[AutoRefund] Refunded order ${orderId} for case ${caseId} (unsupported jurisdiction: ${caseRow.jurisdiction})`,
  );

  return { refunded: true, reason };
}
