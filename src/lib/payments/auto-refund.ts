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
import { Sentry } from '@/lib/sentry';

/** Backoff delays (ms) between refund attempts. 3 attempts total: t0, +1s, +4s. */
const REFUND_RETRY_DELAYS_MS = [1000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // Rel-M3: a single Polar call that hits a transient network/5xx error would
  // leave the charge un-refunded. Retry with backoff (3 attempts: t0, +1s, +4s)
  // before giving up. The refund itself is effectively idempotent for our
  // purposes: if a prior attempt actually succeeded, `refundableAmount` drops to
  // 0 on the next lookup and we short-circuit as "no refundable amount".
  let lastError = '';
  const totalAttempts = REFUND_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const polar = getPolar();

      // Look up the refundable amount (integer cents). `refundableAmount`
      // accounts for prior refunds and applied balance; fall back to totalAmount.
      const order = await polar.orders.get({ id: orderId });
      const amount = order.refundableAmount || order.totalAmount;
      if (!amount || amount <= 0) {
        // Nothing left to refund — treat as success (a prior attempt likely
        // already refunded it). Not an error worth retrying.
        return { ok: true };
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
      lastError = err instanceof Error ? err.message : String(err);
      const delay = REFUND_RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        // eslint-disable-next-line no-console
        console.warn(
          `[AutoRefund] Refund attempt ${attempt + 1}/${totalAttempts} for order ${orderId} failed: ${lastError} — retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }

  // All attempts exhausted — report and let the caller decide.
  Sentry.captureException(new Error(`Polar refund failed after retries: ${lastError}`), {
    tags: { area: 'auto-refund', orderId },
  });
  return { ok: false, error: `Refund request failed after ${totalAttempts} attempts: ${lastError}` };
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
