/**
 * POST /api/webhooks/paddle
 *
 * Receives Paddle Billing webhook events. Pipeline:
 * 1. Read raw body for signature verification
 * 2. Verify HMAC-SHA256 signature
 * 3. Check idempotency (event_id in webhook_events)
 * 4. Store raw event
 * 5. Process event synchronously (lightweight ops)
 *
 * All database operations use the service-role client since
 * webhook requests are not authenticated user sessions.
 */

import { NextResponse } from 'next/server';

import { verifyPaddleWebhookSignature } from '@/lib/payments/paddle-client';
import { processWebhookEvent } from '@/lib/payments/webhook-processor';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import type { PaddleWebhookEvent } from '@/types/external/paddle.types';

/**
 * Paddle webhook IP ranges (SEC-16).
 * Source: https://developer.paddle.com/webhooks/overview#webhook-ip-addresses
 * These IPs are used to validate that webhooks originate from Paddle.
 * When PADDLE_WEBHOOK_IPS is set in env, only those IPs are allowed.
 */
const PADDLE_WEBHOOK_IPS = new Set(
  (process.env.PADDLE_WEBHOOK_IPS ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
);

const WEBHOOK_IP_CHECK_ENABLED = PADDLE_WEBHOOK_IPS.size > 0;

/** Extract client IP from request headers. */
function getWebhookClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown';
}

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    /* ---- SEC-16: Rate limit + optional IP allowlist ---- */
    const webhookIp = getWebhookClientIp(request);

    if (WEBHOOK_IP_CHECK_ENABLED && !PADDLE_WEBHOOK_IPS.has(webhookIp)) {
      return NextResponse.json(
        { error: 'IP not in webhook allowlist' },
        { status: 403 },
      );
    }

    // Rate limit: 100 req/min per IP to prevent webhook spam
    const rateResult = await checkRateLimit('general', `webhook:${webhookIp}`);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Webhook rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    /* ---- Read raw body ---- */
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: 'Empty request body' },
        { status: 400 },
      );
    }

    /* ---- Verify signature ---- */
    const signature = request.headers.get('paddle-signature') ?? '';
    const secret = process.env.PADDLE_WEBHOOK_SECRET ?? '';

    if (!verifyPaddleWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 },
      );
    }

    /* ---- Parse event ---- */
    let event: PaddleWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PaddleWebhookEvent;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 },
      );
    }

    if (!event.event_id || !event.event_type) {
      return NextResponse.json(
        { error: 'Missing event_id or event_type' },
        { status: 400 },
      );
    }

    /* ---- Idempotency + store (single service call) ---- */
    const convex = createServiceConvexClient();
    const svcSecret = serviceSecret();

    const record = await convex.mutation(api.service.recordWebhook, {
      secret: svcSecret,
      eventId: event.event_id,
      provider: 'paddle',
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    });

    if (record.duplicate) {
      // Already processed — return 200 to stop Paddle retries
      return NextResponse.json({ ok: true, duplicate: true });
    }

    /* ---- Process event ---- */
    const result = await processWebhookEvent(event);

    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[Paddle Webhook] Processing failed for ${event.event_type}:`,
        result.error,
      );
      // Still return 200 — the event is stored and can be reprocessed.
    }

    // Mark as processed
    await convex.mutation(api.service.markWebhookProcessed, { secret: svcSecret, eventId: event.event_id });

    return NextResponse.json({ ok: true, event_type: event.event_type });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[Paddle Webhook] Unhandled error:', message);
    // Return 200 to prevent infinite Paddle retries
    return NextResponse.json({ ok: false, error: message });
  }
}
