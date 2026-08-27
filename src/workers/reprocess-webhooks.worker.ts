/**
 * Webhook reprocessing worker — replays stored-but-unprocessed Polar webhooks.
 *
 * The Polar webhook route (/api/webhooks/polar) stores every verified event
 * (recordWebhook) BEFORE dispatching, and marks it processed only after the
 * handler succeeds. A transient Convex/Redis blip during the handler — or the
 * follow-up markProcessed — leaves the event stored with `processedAt` null:
 * Polar got its 200 and will never retry, so nothing else would ever replay it.
 * This repeatable job polls for those events and re-dispatches them.
 *
 * Runs as a repeatable job (every 3 minutes), mirroring the deadline-check
 * worker. Uses the service Convex client (workerConvex).
 *
 * Safety:
 *  - The stored payload was signature-verified when first received (the route
 *    verifies BEFORE storing), so NO re-verification is needed here.
 *  - The processor handlers are idempotent (they check current state — already
 *    paid, subscription already exists, etc.), so replay is safe.
 *  - Each event is wrapped in its own try/catch: a failing one stays
 *    unprocessed for the next run and is reported to Sentry.
 */

import { Worker, type Job } from 'bullmq';
import { z } from 'zod';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { workerConvex, api } from '@/lib/convex/worker-client';
import { Sentry } from '@/lib/sentry';
import {
  handleOrderPaid,
  handleOrderRefunded,
  handleSubscriptionActive,
  handleSubscriptionCanceled,
  handleSubscriptionUpdated,
  handleSubscriptionRevoked,
  type WebhookProcessResult,
} from '@/lib/payments/webhook-processor';

/**
 * Minimal shape of a stored webhook payload: a Polar event carries a `type`
 * discriminator and a `data` object. The handlers Zod-parse `data` themselves
 * (via the polar.types schemas), so we validate only the envelope here.
 */
const storedWebhookPayloadSchema = z
  .object({
    type: z.string().min(1),
    data: z.unknown(),
  })
  .passthrough();

/**
 * Re-dispatches a stored payload to the matching processor handler by `type`.
 *
 * The handlers' param types are derived from the SDK's `validateEvent` union,
 * which we cannot reconstruct from plain JSON (no signature). Since every
 * handler only reads `payload.data` and Zod-parses it, we pass the validated
 * envelope through as the handler's expected `{ type, data }` shape. The cast is
 * confined to this adapter; the runtime safety comes from the handlers' own Zod
 * parse of `data`. Returns null for event types we do not process.
 */
async function redispatchStored(
  payload: { type: string; data: unknown },
): Promise<WebhookProcessResult | null> {
  switch (payload.type) {
    case 'order.paid':
      return handleOrderPaid(payload as Parameters<typeof handleOrderPaid>[0]);
    case 'order.refunded':
      return handleOrderRefunded(payload as Parameters<typeof handleOrderRefunded>[0]);
    case 'subscription.active':
      return handleSubscriptionActive(payload as Parameters<typeof handleSubscriptionActive>[0]);
    case 'subscription.canceled':
      return handleSubscriptionCanceled(payload as Parameters<typeof handleSubscriptionCanceled>[0]);
    case 'subscription.updated':
      return handleSubscriptionUpdated(payload as Parameters<typeof handleSubscriptionUpdated>[0]);
    case 'subscription.revoked':
      return handleSubscriptionRevoked(payload as Parameters<typeof handleSubscriptionRevoked>[0]);
    default:
      // Unhandled event type (checkout.*, benefit.*, etc.). Nothing to do, but
      // mark it processed so we stop re-fetching it every run.
      return null;
  }
}

async function processReprocessWebhooks(_job: Job): Promise<void> {
  const events = await workerConvex.query(api.service.listUnprocessedWebhooks, {
    olderThanMs: 2 * 60 * 1000,
    limit: 50,
  });

  if (events.length === 0) return;

  // eslint-disable-next-line no-console
  console.log(`[ReprocessWebhooks] Found ${events.length} unprocessed webhook(s)`);

  for (const event of events) {
    const eventId = event.eventId as string;
    try {
      const parsed = storedWebhookPayloadSchema.parse(event.payload);
      const result = await redispatchStored({ type: parsed.type, data: parsed.data });

      // A handler that returns ok:false (e.g. no case found yet) should NOT be
      // marked processed — leave it for a later run. null = unhandled type, safe
      // to mark processed so we stop re-fetching it.
      if (result && result.ok === false) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ReprocessWebhooks] Handler for ${eventId} (${parsed.type}) returned not-ok: ${result.error ?? 'unknown'} — leaving unprocessed`,
        );
        continue;
      }

      await workerConvex.mutation(api.service.markWebhookProcessed, { eventId });

      // eslint-disable-next-line no-console
      console.log(`[ReprocessWebhooks] Reprocessed ${eventId} (${parsed.type})`);
    } catch (err) {
      // A failing event stays unprocessed for the next run.
      // eslint-disable-next-line no-console
      console.error(`[ReprocessWebhooks] Failed to reprocess ${eventId}:`, err);
      Sentry.captureException(err, {
        tags: { area: 'reprocess-webhooks', eventId },
      });
    }
  }
}

export function createReprocessWebhooksWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(
    QUEUE_NAMES.REPROCESS_WEBHOOKS,
    processReprocessWebhooks,
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[ReprocessWebhooks] Check ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[ReprocessWebhooks] Check ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { tags: { area: 'reprocess-webhooks' } });
  });

  return worker;
}
