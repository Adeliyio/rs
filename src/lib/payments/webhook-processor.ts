/**
 * Paddle webhook event processor — server-only.
 *
 * Processes Paddle webhook events after they've been verified and
 * stored for idempotency. Handles transaction completion, refunds,
 * subscription lifecycle, and disputes.
 *
 * Uses the service-role Supabase client since webhooks run outside
 * a user session.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { enqueuePaymentConfirmationEmail } from '@/lib/queue/enqueue';
import type {
  PaddleWebhookEvent,
  TransactionCompletedEvent,
  TransactionRefundedEvent,
  SubscriptionCreatedEvent,
  SubscriptionCanceledEvent,
  SubscriptionUpdatedEvent,
} from '@/types/external/paddle.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface WebhookProcessResult {
  ok: boolean;
  event_type: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Transaction completed                                             */
/* ------------------------------------------------------------------ */

async function handleTransactionCompleted(
  event: TransactionCompletedEvent,
): Promise<WebhookProcessResult> {
  const supabase = createServiceRoleClient();
  const txn = event.data;

  // Find the case by paddle_transaction_id
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('id, user_id, payment_status')
    .eq('paddle_transaction_id', txn.id)
    .single();

  if (caseError || !caseData) {
    // Transaction may not be linked to a case yet (subscription purchase)
    // Check if it's a subscription creation — handled separately
    if (txn.subscription_id) {
      return { ok: true, event_type: event.event_type };
    }

    return {
      ok: false,
      event_type: event.event_type,
      error: `No case found for transaction ${txn.id}`,
    };
  }

  const caseRow = caseData as unknown as { id: string; user_id: string; payment_status: string; status: string };

  // Already processed — idempotent
  if (caseRow.payment_status === 'paid') {
    return { ok: true, event_type: event.event_type };
  }

  // Update case payment status to 'paid'
  const { error: updateError } = await supabase
    .from('cases')
    // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
    .update({
      payment_status: 'paid' as const,
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseRow.id);

  if (updateError) {
    return {
      ok: false,
      event_type: event.event_type,
      error: `Failed to update case payment status: ${updateError.message}`,
    };
  }

  /* ---- Queue payment confirmation email (best-effort) ---- */
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(caseRow.user_id);
    const userEmail = userData?.user?.email;
    if (userEmail) {
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      const amount = txn.total
        ? `$${(Number(txn.total) / 100).toFixed(2)}`
        : '$49.00';
      await enqueuePaymentConfirmationEmail(
        userEmail,
        amount,
        'Deposit Demand Letter',
        caseRow.id,
        `${appUrl}/case/${caseRow.id}`,
      );
    }
  } catch (emailErr) {
    // Non-critical — don't fail the webhook
    // eslint-disable-next-line no-console
    console.error('Failed to enqueue payment confirmation email:', emailErr);
  }

  return { ok: true, event_type: event.event_type };
}

/* ------------------------------------------------------------------ */
/*  Transaction refunded                                              */
/* ------------------------------------------------------------------ */

async function handleTransactionRefunded(
  event: TransactionRefundedEvent,
): Promise<WebhookProcessResult> {
  const supabase = createServiceRoleClient();
  const txn = event.data;

  const { data: refundCaseData, error: refundCaseError } = await supabase
    .from('cases')
    .select('id, payment_status, status')
    .eq('paddle_transaction_id', txn.id)
    .single();

  if (refundCaseError || !refundCaseData) {
    return {
      ok: false,
      event_type: event.event_type,
      error: `No case found for refunded transaction ${txn.id}`,
    };
  }

  const refundCase = refundCaseData as unknown as { id: string; payment_status: string; status: string };

  // Update payment status to refunded and close the case
  const { error: refundUpdateError } = await supabase
    .from('cases')
    // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
    .update({
      payment_status: 'refunded' as const,
      status: 'closed' as const,
      updated_at: new Date().toISOString(),
    })
    .eq('id', refundCase.id);

  if (refundUpdateError) {
    return {
      ok: false,
      event_type: event.event_type,
      error: `Failed to update case for refund: ${refundUpdateError.message}`,
    };
  }

  // Record status history
  const historyPayload = {
    case_id: refundCase.id,
    previous_status: refundCase.status,
    new_status: 'closed',
  };
  // @ts-expect-error — service-role Supabase client resolves Insert generics as never
  await supabase.from('case_status_history').insert(historyPayload);

  return { ok: true, event_type: event.event_type };
}

/* ------------------------------------------------------------------ */
/*  Subscription created                                              */
/* ------------------------------------------------------------------ */

async function handleSubscriptionCreated(
  event: SubscriptionCreatedEvent,
): Promise<WebhookProcessResult> {
  const supabase = createServiceRoleClient();
  const sub = event.data;

  // Resolve plan from product name
  const productName = sub.items[0]?.product?.name ?? '';
  const plan = productName.toLowerCase().includes('annual')
    ? 'annual_unlimited'
    : 'monthly_unlimited';

  // Check for existing subscription (idempotency)
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('paddle_subscription_id', sub.id)
    .single();

  if (existing) {
    return { ok: true, event_type: event.event_type };
  }

  const subscriptionPayload = {
    user_id: sub.customer_id,
    paddle_subscription_id: sub.id,
    plan,
    status: 'active',
    current_period_start: sub.current_billing_period.starts_at,
    current_period_end: sub.current_billing_period.ends_at,
    cancel_at_period_end: false,
  };
  // @ts-expect-error — service-role Supabase client resolves Insert generics as never
  const { error: insertError } = await supabase.from('subscriptions').insert(subscriptionPayload);

  if (insertError) {
    return {
      ok: false,
      event_type: event.event_type,
      error: `Failed to create subscription: ${insertError.message}`,
    };
  }

  return { ok: true, event_type: event.event_type };
}

/* ------------------------------------------------------------------ */
/*  Subscription canceled                                             */
/* ------------------------------------------------------------------ */

async function handleSubscriptionCanceled(
  event: SubscriptionCanceledEvent,
): Promise<WebhookProcessResult> {
  const supabase = createServiceRoleClient();
  const sub = event.data;

  const { error: cancelUpdateError } = await supabase
    .from('subscriptions')
    // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
    .update({
      status: 'canceled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', sub.id);

  if (cancelUpdateError) {
    return {
      ok: false,
      event_type: event.event_type,
      error: `Failed to cancel subscription: ${cancelUpdateError.message}`,
    };
  }

  return { ok: true, event_type: event.event_type };
}

/* ------------------------------------------------------------------ */
/*  Subscription updated                                              */
/* ------------------------------------------------------------------ */

async function handleSubscriptionUpdated(
  event: SubscriptionUpdatedEvent,
): Promise<WebhookProcessResult> {
  const supabase = createServiceRoleClient();
  const sub = event.data;

  // Update status and billing period (handles renewals, plan changes, etc.)
  const updatePayload: Record<string, unknown> = {
    status: sub.status,
    updated_at: new Date().toISOString(),
  };

  // Update billing period if present (renewal)
  if (sub.current_billing_period) {
    updatePayload.current_period_start = sub.current_billing_period.starts_at;
    updatePayload.current_period_end = sub.current_billing_period.ends_at;
  }

  // Detect plan change
  if (sub.items?.[0]?.product?.name) {
    const productName = sub.items[0].product.name;
    const newPlan = productName.toLowerCase().includes('annual')
      ? 'annual_unlimited'
      : 'monthly_unlimited';
    updatePayload.plan = newPlan;
  }

  // Detect cancellation scheduling
  if (sub.scheduled_change?.action === 'cancel') {
    updatePayload.cancel_at_period_end = true;
  }

  const { error: subUpdateError } = await supabase
    .from('subscriptions')
    // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
    .update(updatePayload)
    .eq('paddle_subscription_id', sub.id);

  if (subUpdateError) {
    return {
      ok: false,
      event_type: event.event_type,
      error: `Failed to update subscription: ${subUpdateError.message}`,
    };
  }

  return { ok: true, event_type: event.event_type };
}

/* ------------------------------------------------------------------ */
/*  Main dispatcher                                                   */
/* ------------------------------------------------------------------ */

/**
 * Processes a Paddle webhook event. Route to the appropriate handler
 * based on event_type.
 *
 * This function is called after the event has been:
 * 1. Signature-verified
 * 2. Stored in webhook_events for idempotency
 */
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
      // Log disputed transactions — admin alert needed
      // eslint-disable-next-line no-console
      console.error(
        `[Paddle] Transaction disputed: ${event.data.id}, reason: ${event.data.dispute.reason}`,
      );
      return { ok: true, event_type: event.event_type };
    default:
      return {
        ok: false,
        event_type: 'unknown',
        error: `Unhandled event type`,
      };
  }
}
