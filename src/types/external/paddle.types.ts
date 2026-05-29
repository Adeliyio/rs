/* ------------------------------------------------------------------ */
/*  Paddle external API types                                         */
/* ------------------------------------------------------------------ */

/* ---------- Webhook event types ---------- */

export const PADDLE_EVENT_TYPES = [
  'transaction.completed',
  'transaction.refunded',
  'subscription.created',
  'subscription.canceled',
  'subscription.updated',
  'transaction.disputed',
] as const;

export type PaddleEventType = (typeof PADDLE_EVENT_TYPES)[number];

/* ---------- Shared data shapes ---------- */

export interface PaddleCheckoutItem {
  price_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
  };
}

export interface PaddleCheckoutSession {
  transaction_id: string;
  status: string;
  customer_id: string;
  items: PaddleCheckoutItem[];
}

/* ---------- Discriminated webhook events ---------- */

interface PaddleWebhookBase {
  event_id: string;
  occurred_at: string;
}

export interface TransactionCompletedEvent extends PaddleWebhookBase {
  event_type: 'transaction.completed';
  data: {
    id: string;
    customer_id: string;
    subscription_id: string | null;
    status: 'completed';
    items: PaddleCheckoutItem[];
    total: string;
    currency_code: string;
  };
}

export interface TransactionRefundedEvent extends PaddleWebhookBase {
  event_type: 'transaction.refunded';
  data: {
    id: string;
    customer_id: string;
    subscription_id: string | null;
    status: 'refunded';
    refund: {
      id: string;
      amount: string;
      reason: string;
    };
  };
}

export interface TransactionDisputedEvent extends PaddleWebhookBase {
  event_type: 'transaction.disputed';
  data: {
    id: string;
    customer_id: string;
    dispute: {
      id: string;
      reason: string;
      amount: string;
    };
  };
}

export interface SubscriptionCreatedEvent extends PaddleWebhookBase {
  event_type: 'subscription.created';
  data: {
    id: string;
    customer_id: string;
    status: 'active';
    items: PaddleCheckoutItem[];
    current_billing_period: {
      starts_at: string;
      ends_at: string;
    };
  };
}

export interface SubscriptionCanceledEvent extends PaddleWebhookBase {
  event_type: 'subscription.canceled';
  data: {
    id: string;
    customer_id: string;
    status: 'canceled';
    canceled_at: string;
    effective_from: string;
  };
}

export interface SubscriptionUpdatedEvent extends PaddleWebhookBase {
  event_type: 'subscription.updated';
  data: {
    id: string;
    customer_id: string;
    status: string;
    items: PaddleCheckoutItem[];
    next_billed_at: string | null;
    current_billing_period?: {
      starts_at: string;
      ends_at: string;
    };
    scheduled_change?: {
      action: 'cancel' | 'pause' | 'resume';
      effective_at: string;
    };
  };
}

export type PaddleWebhookEvent =
  | TransactionCompletedEvent
  | TransactionRefundedEvent
  | TransactionDisputedEvent
  | SubscriptionCreatedEvent
  | SubscriptionCanceledEvent
  | SubscriptionUpdatedEvent;
