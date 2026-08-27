/**
 * Webhook processing worker — processes webhook-process queue jobs.
 *
 * Under Polar, payment webhooks are verified and processed INLINE by the
 * `@polar-sh/nextjs` adapter in `/api/webhooks/polar` (synchronous, no queue).
 * This worker remains as the queue consumer for any residual async webhook jobs
 * (e.g. Resend delivery events) — it validates the job and acknowledges it. It
 * no longer dispatches Polar payment events; those never reach the queue.
 */

import { Worker, type Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import {
  webhookProcessingJobSchema,
  type WebhookProcessingJobPayload,
} from '@/types/jobs/webhook-processing.job';
import { Sentry } from '@/lib/sentry';

async function processWebhook(
  job: Job<WebhookProcessingJobPayload>,
): Promise<void> {
  const payload = webhookProcessingJobSchema.parse(job.data);

  // Polar payment webhooks are handled inline at /api/webhooks/polar and are
  // never enqueued. Any other provider job is acknowledged as a no-op here.
  // eslint-disable-next-line no-console
  console.log(
    `[WebhookWorker] Acknowledged ${payload.provider} webhook job (event: ${payload.event_id}) — no async processing needed`,
  );
}

export function createWebhookProcessWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(
    QUEUE_NAMES.WEBHOOK_PROCESS,
    processWebhook,
    {
      connection,
      concurrency: 3,
    },
  );

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[WebhookWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { tags: { area: 'webhook-process' } });
  });

  return worker;
}
