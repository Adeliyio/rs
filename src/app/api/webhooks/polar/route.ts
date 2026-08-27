/**
 * POST /api/webhooks/polar
 *
 * Receives Polar webhook events. The `@polar-sh/nextjs` `Webhooks()` adapter
 * verifies the Standard Webhooks HMAC signature (webhook-id / webhook-timestamp
 * / webhook-signature headers against POLAR_WEBHOOK_SECRET) and dispatches typed
 * payloads to the processor handlers.
 *
 * Idempotency (preserved from the Paddle route): before dispatching we record
 * the Standard Webhooks `webhook-id` in `webhook_events` — a duplicate delivery
 * short-circuits with 200 so Polar stops retrying. After a successful dispatch
 * we mark it processed. The service-role Convex client is used since webhook
 * requests are not authenticated user sessions.
 */

import { NextResponse } from 'next/server';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import * as Sentry from '@sentry/nextjs';

import {
  handleOrderPaid,
  handleOrderRefunded,
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionUpdated,
  handleSubscriptionRevoked,
} from '@/lib/payments/webhook-processor';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

/** Extract client IP from request headers (for rate limiting). Prefer the
 * Cloudflare-set header, which the client cannot spoof, over X-Forwarded-For. */
function getWebhookClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Dispatch a signature-verified Polar event to the matching processor handler.
 * `event` is the discriminated union returned by validateEvent; we only act on
 * the types we care about and ignore the rest.
 */
async function dispatch(event: ReturnType<typeof validateEvent>): Promise<void> {
  switch (event.type) {
    case 'order.paid':
      await handleOrderPaid(event);
      return;
    case 'order.refunded':
      await handleOrderRefunded(event);
      return;
    case 'subscription.active':
      await handleSubscriptionActive(event);
      return;
    case 'subscription.canceled':
      await handleSubscriptionCanceled(event);
      return;
    case 'subscription.updated':
      await handleSubscriptionUpdated(event);
      return;
    case 'subscription.revoked':
      await handleSubscriptionRevoked(event);
      return;
    default:
      // Unhandled event type (checkout.*, benefit.*, etc.) — acknowledged, no-op.
      return;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    /* ---- Rate limit (fail-closed 'general' bucket, keyed on unspoofable IP) ---- */
    const webhookIp = getWebhookClientIp(request);
    const rateResult = await checkRateLimit('general', `webhook:${webhookIp}`);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Webhook rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    /* ---- The signing secret MUST be configured. Refusing an unverifiable
       webhook is correct: without a secret, any forged request would otherwise
       be trusted. Fail closed rather than accept-all. ---- */
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // eslint-disable-next-line no-console
      console.error('[Polar Webhook] POLAR_WEBHOOK_SECRET is not set — refusing.');
      Sentry.captureMessage('Polar webhook received but POLAR_WEBHOOK_SECRET is unset', 'error');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    const webhookId = request.headers.get('webhook-id') ?? '';
    if (!webhookId) {
      return NextResponse.json({ error: 'Missing webhook-id header' }, { status: 400 });
    }

    /* ---- 1. VERIFY THE SIGNATURE FIRST — before any DB write. A forged or
       tampered event never reaches storage or the handlers. ---- */
    let event: ReturnType<typeof validateEvent>;
    try {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });
      event = validateEvent(rawBody, headers, webhookSecret);
    } catch (verifyErr) {
      if (verifyErr instanceof WebhookVerificationError) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 });
      }
      throw verifyErr;
    }

    /* ---- 2. Idempotency + store (only after the event is proven authentic) ---- */
    const convex = createServiceConvexClient();
    const svcSecret = serviceSecret();

    const record = await convex.mutation(api.service.recordWebhook, {
      secret: svcSecret,
      eventId: webhookId,
      provider: 'polar',
      payload: JSON.parse(rawBody) as Record<string, unknown>,
    });

    if (record.duplicate) {
      // Already processed — 200 stops Polar retries.
      return NextResponse.json({ ok: true, duplicate: true });
    }

    /* ---- 3. Dispatch. On handler failure we do NOT mark processed, so the
       reprocessing worker (reprocess-webhooks) can replay it later. ---- */
    let dispatchOk = true;
    try {
      await dispatch(event);
    } catch (dispatchErr) {
      dispatchOk = false;
      // eslint-disable-next-line no-console
      console.error('[Polar Webhook] Handler failed:', dispatchErr);
      Sentry.captureException(dispatchErr, { tags: { area: 'polar-webhook', eventType: event.type } });
    }

    if (dispatchOk) {
      await convex.mutation(api.service.markWebhookProcessed, {
        secret: svcSecret,
        eventId: webhookId,
      });
    }

    // 200 either way so Polar stops retrying; unprocessed events are replayed
    // by the reprocessing worker, not by Polar.
    return NextResponse.json({ ok: dispatchOk });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Polar Webhook] Unhandled error:', err);
    Sentry.captureException(err, { tags: { area: 'polar-webhook' } });
    // Generic body (no internal detail); 200 to prevent infinite Polar retries.
    return NextResponse.json({ ok: false });
  }
}
