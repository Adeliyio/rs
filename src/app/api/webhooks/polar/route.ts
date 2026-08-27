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
import { Webhooks } from '@polar-sh/nextjs';

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

/** Extract client IP from request headers (for rate limiting). */
function getWebhookClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? 'unknown';
}

// The adapter verifies the signature and dispatches to the typed handlers.
// Handler errors surface as a thrown error from the adapter, which we treat as
// "stored but not processed" (200, reprocessable) below.
const handlePolarWebhook = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? '',
  onOrderPaid: async (payload) => {
    await handleOrderPaid(payload);
  },
  onOrderRefunded: async (payload) => {
    await handleOrderRefunded(payload);
  },
  onSubscriptionActive: async (payload) => {
    await handleSubscriptionActive(payload);
  },
  onSubscriptionCanceled: async (payload) => {
    await handleSubscriptionCanceled(payload);
  },
  onSubscriptionUpdated: async (payload) => {
    await handleSubscriptionUpdated(payload);
  },
  onSubscriptionRevoked: async (payload) => {
    await handleSubscriptionRevoked(payload);
  },
});

export async function POST(request: Request) {
  try {
    /* ---- Rate limit ---- */
    const webhookIp = getWebhookClientIp(request);
    const rateResult = await checkRateLimit('general', `webhook:${webhookIp}`);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Webhook rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    /* ---- Read raw body once (needed for idempotency payload + adapter) ---- */
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    // Standard Webhooks delivery id — the stable idempotency key across retries.
    const webhookId = request.headers.get('webhook-id') ?? '';
    if (!webhookId) {
      return NextResponse.json({ error: 'Missing webhook-id header' }, { status: 400 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    /* ---- Idempotency + store (single service call) ---- */
    const convex = createServiceConvexClient();
    const svcSecret = serviceSecret();

    const record = await convex.mutation(api.service.recordWebhook, {
      secret: svcSecret,
      eventId: webhookId,
      provider: 'polar',
      payload,
    });

    if (record.duplicate) {
      // Already processed — return 200 to stop Polar retries.
      return NextResponse.json({ ok: true, duplicate: true });
    }

    /* ---- Verify signature + dispatch via the adapter ---- */
    // The adapter re-reads the request body, so hand it a fresh Request with the
    // same body + headers. A 403 from the adapter means signature verification
    // failed — surface it directly.
    const adapterRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: rawBody,
    });

    let dispatchOk = true;
    try {
      const adapterResponse = await handlePolarWebhook(
        adapterRequest as unknown as Parameters<typeof handlePolarWebhook>[0],
      );
      if (adapterResponse.status === 403) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } catch (dispatchErr) {
      dispatchOk = false;
      // eslint-disable-next-line no-console
      console.error('[Polar Webhook] Handler failed:', dispatchErr);
      // Still 200 — the event is stored and can be reprocessed.
    }

    if (dispatchOk) {
      await convex.mutation(api.service.markWebhookProcessed, {
        secret: svcSecret,
        eventId: webhookId,
      });
    }

    return NextResponse.json({ ok: dispatchOk });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[Polar Webhook] Unhandled error:', message);
    // Return 200 to prevent infinite Polar retries.
    return NextResponse.json({ ok: false, error: message });
  }
}
