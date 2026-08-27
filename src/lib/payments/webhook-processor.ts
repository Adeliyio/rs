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
import type { Webhooks } from '@polar-sh/nextjs';

/**
 * Handler payload types, derived from the `@polar-sh/nextjs` `Webhooks()` config
 * so they ALWAYS match the exact `@polar-sh/sdk` version the adapter resolves
 * (the adapter pins ^0.47; the app's top-level SDK is a newer minor). Importing
 * the payload types from a fixed SDK path would bind to the wrong copy and fail
 * to assign. We Zod-parse `payload.data` anyway (CLAUDE.md §2.1), so we only need
 * the outer payload shape here.
 */
type WebhooksConfig = Parameters<typeof Webhooks>[0];
type WebhookOrderPaidPayload = Parameters<NonNullable<WebhooksConfig['onOrderPaid']>>[0];
type WebhookOrderRefundedPayload = Parameters<NonNullable<WebhooksConfig['onOrderRefunded']>>[0];
type WebhookSubscriptionActivePayload = Parameters<NonNullable<WebhooksConfig['onSubscriptionActive']>>[0];
type WebhookSubscriptionCanceledPayload = Parameters<NonNullable<WebhooksConfig['onSubscriptionCanceled']>>[0];
type WebhookSubscriptionUpdatedPayload = Parameters<NonNullable<WebhooksConfig['onSubscriptionUpdated']>>[0];
type WebhookSubscriptionRevokedPayload = Parameters<NonNullable<WebhooksConfig['onSubscriptionRevoked']>>[0];

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
    try {
      await processAutoRefundIfNeeded(caseRow.id, order.id);
    } catch (refundErr) {
      // eslint-disable-next-line no-console
      console.error('[Webhook] Auto-refund for unsupported jurisdiction failed:', refundErr);
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

  await workerConvex.mutation(api.service.createSubscription, {
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
