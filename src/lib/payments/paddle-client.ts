/**
 * Paddle API client — server-only.
 *
 * Provides helpers for interacting with the Paddle Billing API:
 * webhook signature verification, transaction lookup, and
 * subscription management.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/* ------------------------------------------------------------------ */
/*  Pricing SKUs                                                      */
/* ------------------------------------------------------------------ */

export const PADDLE_SKUS = {
  DEPOSIT_SINGLE: 'deposit_single',
  MONTHLY_UNLIMITED: 'monthly_unlimited',
  ANNUAL_UNLIMITED: 'annual_unlimited',
} as const;

export type PaddleSku = (typeof PADDLE_SKUS)[keyof typeof PADDLE_SKUS];

export const SKU_PRICES: Record<PaddleSku, { amount: number; type: 'one_time' | 'recurring' }> = {
  deposit_single: { amount: 4900, type: 'one_time' },
  monthly_unlimited: { amount: 1500, type: 'recurring' },
  annual_unlimited: { amount: 12900, type: 'recurring' },
};

/* ------------------------------------------------------------------ */
/*  Webhook signature verification                                    */
/* ------------------------------------------------------------------ */

/**
 * Verifies the Paddle webhook signature using HMAC-SHA256.
 *
 * Paddle sends a `Paddle-Signature` header in the format:
 *   ts=<timestamp>;h1=<hmac_hex>
 *
 * The signed content is: `<timestamp>:<raw_body>`
 *
 * @param rawBody  The raw request body as string.
 * @param signature  The value of the Paddle-Signature header.
 * @param secret  The PADDLE_WEBHOOK_SECRET.
 * @returns  true if the signature is valid.
 */
export function verifyPaddleWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  // Parse ts and h1 from the signature header
  const parts = signature.split(';');
  const tsEntry = parts.find((p) => p.startsWith('ts='));
  const h1Entry = parts.find((p) => p.startsWith('h1='));

  if (!tsEntry || !h1Entry) return false;

  const timestamp = tsEntry.slice(3);
  const expectedHmac = h1Entry.slice(3);

  if (!timestamp || !expectedHmac) return false;

  // Verify the timestamp is within 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (isNaN(eventTime) || Math.abs(now - eventTime) > 300) return false;

  // Compute the HMAC
  const signedPayload = `${timestamp}:${rawBody}`;
  const computedHmac = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(computedHmac, 'hex'),
      Buffer.from(expectedHmac, 'hex'),
    );
  } catch {
    return false;
  }
}

