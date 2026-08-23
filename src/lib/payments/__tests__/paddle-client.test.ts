/**
 * Tests for Paddle client utilities.
 *
 * Tests webhook signature verification, SKU resolution, and
 * pricing configuration.
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyPaddleWebhookSignature,
  SKU_PRICES,
} from '@/lib/payments/paddle-client';

/* ------------------------------------------------------------------ */
/*  Signature verification                                            */
/* ------------------------------------------------------------------ */

describe('verifyPaddleWebhookSignature', () => {
  const secret = 'test-webhook-secret-key';

  function createValidSignature(body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signedPayload = `${timestamp}:${body}`;
    const hmac = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    return `ts=${timestamp};h1=${hmac}`;
  }

  it('accepts a valid signature', () => {
    const body = '{"event_id":"evt_123","event_type":"transaction.completed"}';
    const signature = createValidSignature(body);

    expect(verifyPaddleWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    const body = '{"event_id":"evt_123"}';
    const signature = 'ts=123;h1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    expect(verifyPaddleWebhookSignature(body, signature, secret)).toBe(false);
  });

  it('rejects if body was tampered with', () => {
    const originalBody = '{"event_id":"evt_123"}';
    const signature = createValidSignature(originalBody);
    const tamperedBody = '{"event_id":"evt_456"}';

    expect(verifyPaddleWebhookSignature(tamperedBody, signature, secret)).toBe(
      false,
    );
  });

  it('rejects empty signature', () => {
    expect(verifyPaddleWebhookSignature('body', '', secret)).toBe(false);
  });

  it('rejects empty secret', () => {
    const body = '{"test":true}';
    const signature = createValidSignature(body);
    expect(verifyPaddleWebhookSignature(body, signature, '')).toBe(false);
  });

  it('rejects malformed signature header', () => {
    expect(
      verifyPaddleWebhookSignature('body', 'not-a-valid-format', secret),
    ).toBe(false);
  });

  it('rejects signature with missing ts', () => {
    expect(
      verifyPaddleWebhookSignature('body', 'h1=abc123', secret),
    ).toBe(false);
  });

  it('rejects signature with missing h1', () => {
    expect(
      verifyPaddleWebhookSignature('body', 'ts=123', secret),
    ).toBe(false);
  });

  it('rejects signature older than 5 minutes', () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
    const signedPayload = `${oldTimestamp}:test`;
    const hmac = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    const signature = `ts=${oldTimestamp};h1=${hmac}`;

    expect(verifyPaddleWebhookSignature('test', signature, secret)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Pricing configuration                                             */
/* ------------------------------------------------------------------ */

describe('SKU_PRICES', () => {
  it('has correct deposit single price ($49)', () => {
    expect(SKU_PRICES.deposit_single.amount).toBe(4900);
    expect(SKU_PRICES.deposit_single.type).toBe('one_time');
  });

  it('has correct monthly unlimited price ($15)', () => {
    expect(SKU_PRICES.monthly_unlimited.amount).toBe(1500);
    expect(SKU_PRICES.monthly_unlimited.type).toBe('recurring');
  });

  it('has correct annual unlimited price ($129)', () => {
    expect(SKU_PRICES.annual_unlimited.amount).toBe(12900);
    expect(SKU_PRICES.annual_unlimited.type).toBe('recurring');
  });
});
