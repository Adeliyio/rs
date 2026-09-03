/**
 * Polar webhook event processor — server-only.
 *
 * The `@polar-sh/nextjs` `Webhooks()` adapter verifies the Standard Webhooks
 * HMAC signature and dispatches to the exported handlers below with typed SDK
 * payloads. Each handler Zod-parses the fields it reads (CLAUDE.md §2.1), then
 * writes through the service Convex client (workerConvex) — which bypasses
 * per-user authz — since webhooks run outside a user session.
 *
 * Idempotency: the route records the event id in `webhook_events` before
 * dispatching (recordWebhook → skip on duplicate), and marks it processed after.
 */

import { workerConvex, api } from '@/lib/convex/worker-client';
import type { Id } from '@convex/dataModel';
import { enqueuePaymentConfirmationEmail } from '@/lib/queue/enqueue';
import { processAutoRefundIfNeeded } from '@/lib/payments/auto-refund';
import { cancelOutcomeEmails } from '@/lib/outcomes/outcome-scheduler';
import { DEPOSIT_JURISDICTION, type DepositJurisdiction } from '@/types/enums';
import {
  polarOrderSchema,
  polarSubscriptionSchema,
  readCaseIdFromMetadata,
  derivePlan,
} from '@/types/external/polar.types';
import type { validateEvent } from '@polar-sh/sdk/webhooks';

/**
 * Handler payload types, derived from the `validateEvent` return union (the same
 * `@polar-sh/sdk` copy the webhook route verifies with) and narrowed by `type`.
 * Deriving from `validateEvent` — rather than the `@polar-sh/nextjs` adapter —
 * keeps both sides on ONE SDK version (the app pins 0.49; the adapter's own copy
 * is 0.47, and mixing them fails to assign). We Zod-parse `payload.data` inside
 * each handler anyway (CLAUDE.md §2.1), so we only need the outer shape here.
 */
type PolarEvent = ReturnType<typeof validateEvent>;
type EventOfType<T extends PolarEvent['type']> = Extract<PolarEvent, { type: T }>;

type WebhookOrderPaidPayload = EventOfType<'order.paid'>;
type WebhookOrderRefundedPayload = EventOfType<'order.refunded'>;
type WebhookSubscriptionActivePayload = EventOfType<'subscription.active'>;
type WebhookSubscriptionCanceledPayload = EventOfType<'subscription.canceled'>;
type WebhookSubscriptionUpdatedPayload = EventOfType<'subscription.updated'>;
type WebhookSubscriptionRevokedPayload = EventOfType<'subscription.revoked'>;

export interface WebhookProcessResult {
  ok: boolean;
  event_type: string;
  error?: string;
}

/** Formats integer cents (Polar amounts) as a `$x.xx` dollar string. */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function dateToMs(d: Date | null | undefined): number | undefined {
  return d ? d.getTime() : undefined;
}

/* ------------------------------------------------------------------ */
/*  order.paid                                                        */
/* ------------------------------------------------------------------ */

/**
 * `order.paid` fires for BOTH one-time letter purchases AND every subscription
 * renewal cycle. We branch on `order.subscriptionId`:
 *   - present  → a subscription cycle; entitlement is handled by the
 *     subscription.* events, so we do NOT run one-time-letter fulfillment here.
 *   - absent   → a one-time deposit-letter order; run the letter fulfillment
 *     (mark the case paid + defense-in-depth refund/confirmation email).
 *
 * The case is located via `order.metadata.caseId` (echoed from checkout) and,
 * as a fallback, via the stored `polar_order_id`.
 */
export async function handleOrderPaid(
  payload: WebhookOrderPaidPayload,
): Promise<WebhookProcessResult> {
  const eventType = 'order.paid';
  const order = polarOrderSchema.parse(payload.data);

  // Subscription-cycle order (renewal): entitlement flows through subscription.*.
  if (order.subscriptionId) {
    return { ok: true, event_type: eventType };
  }

  // One-time deposit-letter order. Locate the case by metadata.caseId, then
  // by the stored polar_order_id.
  const caseIdFromMeta = readCaseIdFromMetadata(order.metadata);

  let caseRow = caseIdFromMeta
    ? await workerConvex.query(api.service.getCase, {
        caseId: caseIdFromMeta as Id<'cases'>,
      })
    : null;

  if (!caseRow) {
    caseRow = await workerConvex.query(api.service.caseByPolarOrder, {
      polarOrderId: order.id,
    });
  }

  if (!caseRow) {
    return {
      ok: false,
      event_type: eventType,
      error: `No case found for order ${order.id}`,
    };
  }

  // Persist the order id on the case if the metadata path found it first (so
  // refunds and lookups by order id resolve later).
  if (!caseRow.polar_order_id) {
    try {
      await workerConvex.mutation(api.service.patchCase, {
        caseId: caseRow.id as Id<'cases'>,
        patch: { polarOrderId: order.id },
      });
    } catch (patchErr) {
      // eslint-disable-next-line no-console
      console.error('[Webhook] Failed to link polar_order_id to case:', patchErr);
    }
  }

  // Idempotent — already paid.
  if (caseRow.payment_status === 'paid') {
    return { ok: true, event_type: eventType };
  }

  // SECURITY: verify the order actually paid at least the deposit-letter price
  // before granting. Without this, a checkout crafted with a cheaper/foreign
  // product could unlock the $49 letter. totalAmount is in cents; the minimum
  // valid deposit price is $49 (4900). A/B variants only ever cost MORE, so a
  // floor check is safe and doesn't false-reject a legitimate variant.
  // Fail CLOSED: reject if the amount is missing/non-numeric OR below the floor.
  const MIN_DEPOSIT_LETTER_CENTS = 4900;
  if (typeof order.totalAmount !== 'number' || order.totalAmount < MIN_DEPOSIT_LETTER_CENTS) {
    // eslint-disable-next-line no-console
    console.error(
      `[Webhook] order ${order.id} amount ${String(order.totalAmount)}c is missing or below ` +
        `the deposit-letter floor (${MIN_DEPOSIT_LETTER_CENTS}c). NOT granting entitlement.`,
    );
    return {
      ok: false,
      event_type: eventType,
      error: `Order amount missing or below expected deposit-letter price`,
    };
  }

  await workerConvex.mutation(api.service.setPaymentStatus, {
    caseId: caseRow.id as Id<'cases'>,
    paymentStatus: 'paid',
  });

  /* ---- R-1: defense-in-depth auto-refund ---- */
  // The create-case + checkout routes already block unsupported deposit
  // jurisdictions before payment, so this should be unreachable via the UI.
  // But an out-of-band charge could still land here — so if a paid deposit case
  // is in an unsupported state, refund it now rather than waiting for /generate.
  const isDeposit = caseRow.wedge === 'deposit';
  const supported =
    isDeposit &&
    DEPOSIT_JURISDICTION.includes(caseRow.jurisdiction as DepositJurisdiction);
  if (isDeposit && !supported) {
    // Rel-M3: if the refund does not go through, we must NOT mark this event
    // processed — otherwise the customer is left charged with no fulfillment and
    // nothing retries. Throwing here leaves the event unprocessed so the
    // reprocessing worker (Rel-M1) replays it and re-attempts the refund. The
    // handler is idempotent: on replay, the case is already paid (short-circuit
    // above) and the refund lookup finds nothing refundable once it succeeds.
    const refundResult = await processAutoRefundIfNeeded(caseRow.id, order.id);
    if (!refundResult.refunded) {
      throw new Error(
        `Auto-refund for unsupported jurisdiction failed for case ${caseRow.id}: ${refundResult.error ?? 'unknown error'}`,
      );
    }
    // Do not send a "your letter is ready" confirmation for a refunded case.
    return { ok: true, event_type: eventType };
  }

  /* ---- payment confirmation email (best-effort) ---- */
  try {
    const userEmail = await workerConvex.query(api.service.userEmailById, {
      userId: caseRow.user_id as Id<'users'>,
    });
    if (userEmail) {
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      // Polar amounts are integer cents already — format directly, no /100 of a string.
      const amount = order.totalAmount ? formatCents(order.totalAmount) : '$49.00';
      await enqueuePaymentConfirmationEmail(
        userEmail,
        amount,
        'Deposit Demand Letter',
        caseRow.id,
        `${appUrl}/case/${caseRow.id}`,
      );
    }
  } catch (emailErr) {
    // eslint-disable-next-line no-console
    console.error('Failed to enqueue payment confirmation email:', emailErr);
  }

  return { ok: true, event_type: eventType };
}

/* ------------------------------------------------------------------ */
/*  order.refunded                                                    */
/* ------------------------------------------------------------------ */

export async function handleOrderRefunded(
  payload: WebhookOrderRefundedPayload,
): Promise<WebhookProcessResult> {
  const eventType = 'order.refunded';
  const order = polarOrderSchema.parse(payload.data);

  const caseIdFromMeta = readCaseIdFromMetadata(order.metadata);
  let caseRow = caseIdFromMeta
    ? await workerConvex.query(api.service.getCase, {
        caseId: caseIdFromMeta as Id<'cases'>,
      })
    : null;
  if (!caseRow) {
    caseRow = await workerConvex.query(api.service.caseByPolarOrder, {
      polarOrderId: order.id,
    });
  }
  if (!caseRow) {
    return {
      ok: false,
      event_type: eventType,
      error: `No case found for refunded order ${order.id}`,
    };
  }

  // Set refunded + close (records status history via setPaymentStatus).
  await workerConvex.mutation(api.service.setPaymentStatus, {
    caseId: caseRow.id as Id<'cases'>,
    paymentStatus: 'refunded',
    newStatus: 'closed',
  });

  // R-2: closing a case must also cancel any scheduled outcome-follow-up emails.
  try {
    await cancelOutcomeEmails(caseRow.id);
  } catch (cancelErr) {
    // eslint-disable-next-line no-console
    console.error('[Webhook] Failed to cancel outcome emails on refund:', cancelErr);
  }

  return { ok: true, event_type: eventType };
}

/* ------------------------------------------------------------------ */
/*  subscription.active (create/activate)                            */
/* ------------------------------------------------------------------ */

export async function handleSubscriptionActive(
  payload: WebhookSubscriptionActivePayload,
): Promise<WebhookProcessResult> {
  const eventType = 'subscription.active';
  const sub = polarSubscriptionSchema.parse(payload.data);
  const plan = derivePlan(sub.product?.name, sub.recurringInterval);

  const existing = await workerConvex.query(api.service.getSubscriptionByPolarId, {
    polarSubscriptionId: sub.id,
  });
  if (existing) return { ok: true, event_type: eventType };

  // CRITICAL: resolve and persist the owner's userId. Without it, currentMine
  // (which filters by userId) can never find the subscription, so the entire
  // Unlimited tier grants nothing and subscribers are re-charged/blocked.
  // Prefer the userId carried in checkout metadata; fall back to the customer
  // email. If neither resolves, still create the row (so revoke/cancel events
  // reconcile) but log loudly — an unlinked subscription is a support case.
  const metaUserId =
    typeof sub.metadata?.userId === 'string' && sub.metadata.userId.length > 0
      ? sub.metadata.userId
      : undefined;

  let userId = metaUserId;
  if (!userId) {
    const email = sub.customer?.email ?? undefined;
    if (email) {
      const resolved = await workerConvex.query(api.service.userIdByEmail, {
        email,
      });
      userId = resolved ?? undefined;
    }
  }

  if (!userId) {
    // eslint-disable-next-line no-console
    console.error(
      `[webhook] subscription.active ${sub.id}: could not resolve userId ` +
        `(metadata.userId + customer.email both missed). Subscription created ` +
        `UNLINKED — the customer will not get entitlement until linked.`,
    );
  }

  await workerConvex.mutation(api.service.createSubscription, {
    // userId is a validated id string from metadata/email lookup; the Convex arg
    // is typed Id<'users'>. Cast at this untyped-client boundary (same pattern as
    // handleOrderPaid). The service mutation re-validates it as v.id('users').
    userId: userId ? (userId as Id<'users'>) : undefined,
    polarCustomerId: sub.customerId ?? undefined,
    polarSubscriptionId: sub.id,
    plan,
    status: 'active',
    currentPeriodStart: dateToMs(sub.currentPeriodStart),
    currentPeriodEnd: dateToMs(sub.currentPeriodEnd),
  });

  return { ok: true, event_type: eventType };
}

/* ------------------------------------------------------------------ */
/*  subscription.canceled (scheduled end — still active until period) */
/* ------------------------------------------------------------------ */

/**
 * `subscription.canceled` only SCHEDULES the end of the subscription; the
 * customer keeps access until the period end. So we mark it `canceled` +
 * `cancelAtPeriodEnd`, but `currentMine` still treats it as entitled until the
 * period expires. Entitlement is turned OFF by `subscription.revoked`, not here.
 */
export async function handleSubscriptionCanceled(
  payload: WebhookSubscriptionCanceledPayload,
): Promise<WebhookProcessResult> {
  const eventType = 'subscription.canceled';
  const sub = polarSubscriptionSchema.parse(payload.data);
  await workerConvex.mutation(api.service.patchSubscriptionByPolarId, {
    polarSubscriptionId: sub.id,
    patch: { status: 'canceled', cancelAtPeriodEnd: true },
  });
  return { ok: true, event_type: eventType };
}

/* ------------------------------------------------------------------ */
/*  subscription.revoked (entitlement OFF)                            */
/* ------------------------------------------------------------------ */

/**
 * `subscription.revoked` fires when access actually ends. We set the status to
 * `revoked` — a value `subscriptions.currentMine` does NOT count as active — so
 * the Unlimited entitlement (and the M1 $49 waiver) turns off immediately.
 */
export async function handleSubscriptionRevoked(
  payload: WebhookSubscriptionRevokedPayload,
): Promise<WebhookProcessResult> {
  const eventType = 'subscription.revoked';
  const sub = polarSubscriptionSchema.parse(payload.data);
  await workerConvex.mutation(api.service.patchSubscriptionByPolarId, {
    polarSubscriptionId: sub.id,
    patch: { status: 'revoked', cancelAtPeriodEnd: true },
  });
  return { ok: true, event_type: eventType };
}

/* ------------------------------------------------------------------ */
/*  subscription.updated (patch status + period + plan)              */
/* ------------------------------------------------------------------ */

export async function handleSubscriptionUpdated(
  payload: WebhookSubscriptionUpdatedPayload,
): Promise<WebhookProcessResult> {
  const eventType = 'subscription.updated';
  const sub = polarSubscriptionSchema.parse(payload.data);

  // Revocation is TERMINAL. Polar also fires subscription.updated on a revoked
  // sub (carrying status 'canceled' + a still-future period end), and delivery
  // order is not assured — so a naive patch would resurrect 'revoked' back to
  // 'canceled' and re-grant Unlimited to a non-paying user until period end.
  // Never downgrade a revoked row.
  const existing = await workerConvex.query(api.service.getSubscriptionByPolarId, {
    polarSubscriptionId: sub.id,
  });
  if (existing?.status === 'revoked') {
    return { ok: true, event_type: eventType };
  }

  const patch: Record<string, unknown> = { status: sub.status };

  const start = dateToMs(sub.currentPeriodStart);
  const end = dateToMs(sub.currentPeriodEnd);
  if (start !== undefined) patch.currentPeriodStart = start;
  if (end !== undefined) patch.currentPeriodEnd = end;

  if (sub.product?.name) {
    patch.plan = derivePlan(sub.product.name, sub.recurringInterval);
  }

  patch.cancelAtPeriodEnd = sub.cancelAtPeriodEnd;

  await workerConvex.mutation(api.service.patchSubscriptionByPolarId, {
    polarSubscriptionId: sub.id,
    patch,
  });
  return { ok: true, event_type: eventType };
}
