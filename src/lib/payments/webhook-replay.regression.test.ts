import { describe, it, expect } from 'vitest';

import {
  polarOrderSchema,
  polarSubscriptionSchema,
  derivePlan,
} from '@/types/external/polar.types';

/**
 * Regression guard for the stranded-payer bug.
 *
 * The Polar webhook route returns HTTP 200 even when a handler fails, so Polar
 * NEVER retries. The reprocessing worker is therefore the ONLY path that can
 * rescue a customer whose fulfillment blipped. That path was dead:
 *
 *  - The route stored `JSON.parse(rawBody)` — Polar's RAW snake_case wire JSON
 *    (`total_amount`, `current_period_end`) — while the live dispatch used the
 *    SDK-parsed camelCase object. Replay fed snake_case into camelCase schemas.
 *  - `order.paid`: `totalAmount` is required, so the parse THREW on every
 *    replay, forever. The payer stayed charged with no letter, permanently.
 *  - `subscription.*`: every field is optional, so the parse SUCCEEDED and
 *    silently wrote a record with NO period dates and a WRONG plan — which later
 *    stripped entitlement from a paid-through subscriber mid-period.
 *
 * These fixtures are PRODUCTION-SHAPED: real Polar wire payloads in snake_case,
 * exactly as they sit in the webhookEvents table today. A camelCase mock is what
 * let this ship — it tested the shape the bug never sees.
 */

/** A real `order.paid` data payload, in Polar's snake_case wire format. */
const RAW_WIRE_ORDER = {
  id: 'ord_01J8XYZ',
  total_amount: 4900,
  subscription_id: null,
  customer_id: 'cus_01J8ABC',
  product_id: 'prod_01J8DEF',
  metadata: { caseId: 'case_abc123' },
  customer: { email: 'jane@example.com' },
  product: { name: 'Deposit Demand Letter' },
};

/** A real `subscription.active` data payload, in snake_case. */
const RAW_WIRE_SUBSCRIPTION = {
  id: 'sub_01J8GHI',
  status: 'active',
  customer_id: 'cus_01J8ABC',
  current_period_start: '2026-09-01T00:00:00Z',
  current_period_end: '2027-09-01T00:00:00Z',
  cancel_at_period_end: true,
  recurring_interval: 'year',
  metadata: { userId: 'user_1' },
  customer: { email: 'jane@example.com' },
  product: { name: 'Annual Unlimited' },
};

describe('replayed webhooks: raw snake_case wire payloads must parse', () => {
  it('parses a raw order.paid instead of throwing on totalAmount', () => {
    const order = polarOrderSchema.parse(RAW_WIRE_ORDER);
    expect(order.totalAmount).toBe(4900);
    expect(order.id).toBe('ord_01J8XYZ');
    // The payer-binding email must survive — it gates entitlement.
    expect(order.customer?.email).toBe('jane@example.com');
    // metadata.caseId is how the handler finds the case to fulfil.
    expect(order.metadata['caseId']).toBe('case_abc123');
  });

  it('clears the $49 floor on replay (was: threw before the check ran)', () => {
    const order = polarOrderSchema.parse(RAW_WIRE_ORDER);
    expect(typeof order.totalAmount).toBe('number');
    expect(order.totalAmount).toBeGreaterThanOrEqual(4900);
  });

  it('keeps subscription period dates (was: silently undefined)', () => {
    const sub = polarSubscriptionSchema.parse(RAW_WIRE_SUBSCRIPTION);
    // These two are what `isEntitled` falls back to once status is no longer
    // 'active'. Undefined here blocks a paid-through subscriber mid-period.
    expect(sub.currentPeriodEnd).toBeInstanceOf(Date);
    expect(sub.currentPeriodStart).toBeInstanceOf(Date);
    expect(sub.currentPeriodEnd?.toISOString()).toBe('2027-09-01T00:00:00.000Z');
  });

  it('keeps cancelAtPeriodEnd true (was: overwritten by the schema default)', () => {
    const sub = polarSubscriptionSchema.parse(RAW_WIRE_SUBSCRIPTION);
    expect(sub.cancelAtPeriodEnd).toBe(true);
  });

  it('records an annual plan as annual (was: silently downgraded to monthly)', () => {
    const sub = polarSubscriptionSchema.parse(RAW_WIRE_SUBSCRIPTION);
    expect(sub.recurringInterval).toBe('year');
    expect(derivePlan(sub.product?.name, sub.recurringInterval)).toBe(
      'annual_unlimited',
    );
  });
});

describe('no regression for the live (SDK-parsed camelCase) path', () => {
  it('still parses a camelCase order', () => {
    const order = polarOrderSchema.parse({
      id: 'ord_camel',
      totalAmount: 4900,
      metadata: { caseId: 'case_1' },
      customer: { email: 'a@b.c' },
    });
    expect(order.totalAmount).toBe(4900);
  });

  it('prefers an explicit camelCase value over its snake_case twin', () => {
    const order = polarOrderSchema.parse({
      id: 'ord_both',
      totalAmount: 4900,
      total_amount: 100,
      metadata: {},
    });
    expect(order.totalAmount).toBe(4900);
  });
});

describe('still fails closed on genuinely missing data', () => {
  it('rejects an order with no amount in either casing', () => {
    expect(() =>
      polarOrderSchema.parse({ id: 'ord_none', metadata: {} }),
    ).toThrow();
  });

  it('rejects an order with no id', () => {
    expect(() =>
      polarOrderSchema.parse({ totalAmount: 4900, metadata: {} }),
    ).toThrow();
  });
});
