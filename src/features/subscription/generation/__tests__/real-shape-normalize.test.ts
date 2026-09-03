/**
 * Regression: the authed subscription path must read answers in the REAL
 * persisted shape — group nodes NESTED under their node id, and booleans stored
 * under the NODE id ('refund_request', 'cancellation_attempts') as the strings
 * 'true'/'false'. The prior tests fed flat, field-keyed inputs that never match
 * this shape, so the data-shape bugs (dropped monthly_charge / dates / refund /
 * prior-attempt) stayed green in CI. This drives the actual normalizer used by
 * the route and asserts the user's values survive.
 */

import { describe, it, expect } from 'vitest';

import { normalizeSubscriptionAnswers } from '@/features/diagnostic/anonymous/anonymous-answers';

describe('subscription answers — REAL persisted shape → normalizer', () => {
  // Exactly how the diagnostic engine persists a completed subscription intake:
  // group nodes are nested objects keyed by node id; boolean nodes store their
  // value under the node id as a 'true'/'false' STRING.
  const persisted: Record<string, unknown> = {
    service_vertical: 'gym',
    company_name: 'FitLife Gym',
    account_identifier: 'MEMBER-12345',
    // group node
    subscription_details: {
      billing_email: 'me@example.com',
      monthly_charge: '49.99',
      billing_frequency: 'monthly',
      last_charge_date: '2026-05-15',
    },
    // boolean node stored by NODE id, as a string
    cancellation_attempts: 'true',
    cancellation_attempt_details: {
      cancellation_date: '2026-04-01',
      cancellation_method: 'phone',
      cancellation_result: 'told to call back',
    },
    refund_request: 'true',
    refund_details: {
      refund_amount: '99.98',
      refund_reason: 'charged after cancellation',
    },
  };

  it('flattens group nodes to the fields the generator reads', () => {
    const n = normalizeSubscriptionAnswers(persisted);
    expect(n.monthly_charge).toBe('49.99');
    expect(n.billing_frequency).toBe('monthly');
    expect(n.last_charge_date).toBe('2026-05-15');
    expect(n.billing_email).toBe('me@example.com');
    expect(n.cancellation_date).toBe('2026-04-01');
    expect(n.cancellation_method).toBe('phone');
    expect(n.cancellation_result).toBe('told to call back');
    expect(n.refund_amount).toBe('99.98');
    expect(n.refund_reason).toBe('charged after cancellation');
  });

  it('coerces boolean-by-node-id strings to real booleans', () => {
    const n = normalizeSubscriptionAnswers(persisted);
    // The string 'false' is truthy — an un-coerced value would silently keep the
    // refund/prior-attempt content that the user did NOT ask for, or (as here)
    // must be a real `true`.
    expect(n.wants_refund).toBe(true);
    expect(n.prior_cancellation_attempt).toBe(true);
    expect(typeof n.wants_refund).toBe('boolean');
    expect(typeof n.prior_cancellation_attempt).toBe('boolean');
  });

  it("treats a 'false' refund/attempt as false, not truthy", () => {
    const n = normalizeSubscriptionAnswers({
      ...persisted,
      cancellation_attempts: 'false',
      refund_request: 'false',
    });
    expect(n.wants_refund).toBe(false);
    expect(n.prior_cancellation_attempt).toBe(false);
  });

  it('maps vertical/service_type from service_vertical', () => {
    const n = normalizeSubscriptionAnswers(persisted);
    expect(n.vertical).toBe('gym');
    expect(n.service_type).toBe('gym');
  });

  it('does not clobber a value already present at the top-level field key', () => {
    const n = normalizeSubscriptionAnswers({
      ...persisted,
      monthly_charge: '10.00', // e.g. from an earlier extraction — must win
    });
    expect(n.monthly_charge).toBe('10.00');
  });
});
