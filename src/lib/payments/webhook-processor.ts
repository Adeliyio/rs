/**
 * Paddle webhook event processor — server-only.
 *
 * Processes verified, idempotency-stored Paddle events. Uses the service Convex
 * client (workerConvex) — replacing the Supabase service-role client — since
 * webhooks run outside a user session.
 */

import { workerConvex, api } from '@/lib/convex/worker-client';
import type { Id } from '@convex/dataModel';
import { enqueuePaymentConfirmationEmail } from '@/lib/queue/enqueue';
import type {
  PaddleWebhookEvent,
  TransactionCompletedEvent,
  TransactionRefundedEvent,
  SubscriptionCreatedEvent,
  SubscriptionCanceledEvent,
  SubscriptionUpdatedEvent,
} from '@/types/external/paddle.types';

export interface WebhookProcessResult {
  ok: boolean;
  event_type: string;
  error?: string;
}

function toMs(iso: string | null | undefined): number | undefined {
  return iso ? new Date(iso).getTime() : undefined;
}

/* ---- transaction.completed ---- */

async function handleTransactionCompleted(
  event: TransactionCompletedEvent,
): Promise<WebhookProcessResult> {
  const txn = event.data;

  const caseRow = await workerConvex.query(api.service.caseByPaddleTxn, {
    paddleTransactionId: txn.id,
  });

  if (!caseRow) {
    if (txn.subscription_id) return { ok: true, event_type: event.event_type };
    return { ok: false, event_type: event.event_type, error: `No case found for transaction ${txn.id}` };
  }

  // Idempotent — already paid.
  if (caseRow.payment_status === 'paid') {
    return { ok: true, event_type: event.event_type };
  }

  await workerConvex.mutation(api.service.setPaymentStatus, {
    caseId: caseRow.id as Id<'cases'>,
    paymentStatus: 'paid',
  });

  /* ---- payment confirmation email (best-effort) ---- */
  try {
    const userEmail = await workerConvex.query(api.service.userEmailById, {
      userId: caseRow.user_id as Id<'users'>,
    });
    if (userEmail) {
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      const amount = txn.total ? `$${(Number(txn.total) / 100).toFixed(2)}` : '$49.00';
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

  return { ok: true, event_type: event.event_type };
}

/* ---- transaction.refunded ---- */

async function handleTransactionRefunded(
  event: TransactionRefundedEvent,
): Promise<WebhookProcessResult> {
  const txn = event.data;

  const caseRow = await workerConvex.query(api.service.caseByPaddleTxn, {
    paddleTransactionId: txn.id,
  });
  if (!caseRow) {
    return { ok: false, event_type: event.event_type, error: `No case found for refunded transaction ${txn.id}` };
  }

  // Set refunded + close (records status history via setPaymentStatus).
  await workerConvex.mutation(api.service.setPaymentStatus, {
    caseId: caseRow.id as Id<'cases'>,
    paymentStatus: 'refunded',
    newStatus: 'closed',
  });

  return { ok: true, event_type: event.event_type };
}

/* ---- subscription.created ---- */

async function handleSubscriptionCreated(
  event: SubscriptionCreatedEvent,
): Promise<WebhookProcessResult> {
  const sub = event.data;
  const productName = sub.items[0]?.product?.name ?? '';
  const plan = productName.toLowerCase().includes('annual') ? 'annual_unlimited' : 'monthly_unlimited';

  const existing = await workerConvex.query(api.service.getSubscriptionByPaddleId, {
    paddleSubscriptionId: sub.id,
  });
  if (existing) return { ok: true, event_type: event.event_type };

  await workerConvex.mutation(api.service.createSubscription, {
    paddleCustomerId: sub.customer_id,
    paddleSubscriptionId: sub.id,
    plan,
    status: 'active',
    currentPeriodStart: toMs(sub.current_billing_period.starts_at),
    currentPeriodEnd: toMs(sub.current_billing_period.ends_at),
  });

  return { ok: true, event_type: event.event_type };
}

/* ---- subscription.canceled ---- */

async function handleSubscriptionCanceled(
  event: SubscriptionCanceledEvent,
): Promise<WebhookProcessResult> {
  const sub = event.data;
  await workerConvex.mutation(api.service.patchSubscriptionByPaddleId, {
    paddleSubscriptionId: sub.id,
    patch: { status: 'canceled', cancelAtPeriodEnd: true },
  });
  return { ok: true, event_type: event.event_type };
}

/* ---- subscription.updated ---- */

async function handleSubscriptionUpdated(
  event: SubscriptionUpdatedEvent,
): Promise<WebhookProcessResult> {
  const sub = event.data;
  const patch: Record<string, unknown> = { status: sub.status };

  if (sub.current_billing_period) {
    patch.currentPeriodStart = toMs(sub.current_billing_period.starts_at);
    patch.currentPeriodEnd = toMs(sub.current_billing_period.ends_at);
  }
  if (sub.items?.[0]?.product?.name) {
    patch.plan = sub.items[0].product.name.toLowerCase().includes('annual')
      ? 'annual_unlimited'
      : 'monthly_unlimited';
  }
  if (sub.scheduled_change?.action === 'cancel') {
    patch.cancelAtPeriodEnd = true;
  }

  await workerConvex.mutation(api.service.patchSubscriptionByPaddleId, {
    paddleSubscriptionId: sub.id,
    patch,
  });
  return { ok: true, event_type: event.event_type };
}

/* ---- dispatcher ---- */

export async function processWebhookEvent(
  event: PaddleWebhookEvent,
): Promise<WebhookProcessResult> {
  switch (event.event_type) {
    case 'transaction.completed':
      return handleTransactionCompleted(event);
    case 'transaction.refunded':
      return handleTransactionRefunded(event);
    case 'subscription.created':
      return handleSubscriptionCreated(event);
    case 'subscription.canceled':
      return handleSubscriptionCanceled(event);
    case 'subscription.updated':
      return handleSubscriptionUpdated(event);
    case 'transaction.disputed':
      // eslint-disable-next-line no-console
      console.error(
        `[Paddle] Transaction disputed: ${event.data.id}, reason: ${event.data.dispute.reason}`,
      );
      return { ok: true, event_type: event.event_type };
    default:
      return { ok: false, event_type: 'unknown', error: `Unhandled event type` };
  }
}
