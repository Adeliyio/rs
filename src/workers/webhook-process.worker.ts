/**
 * Webhook processing worker — processes webhook-process queue jobs.
 *
 * Handles webhook events that were enqueued for async processing.
 * Currently handles Paddle webhook events.
 */

import { Worker, type Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { processWebhookEvent } from '@/lib/payments/webhook-processor';
import {
  webhookProcessingJobSchema,
  type WebhookProcessingJobPayload,
} from '@/types/jobs/webhook-processing.job';
import type { PaddleWebhookEvent } from '@/types/external/paddle.types';

async function processWebhook(
  job: Job<WebhookProcessingJobPayload>,
): Promise<void> {
  const payload = webhookProcessingJobSchema.parse(job.data);

  if (payload.provider !== 'paddle') {
    // eslint-disable-next-line no-console
    console.warn(`[WebhookWorker] Unknown provider: ${payload.provider}`);
    return;
  }

  const event = JSON.parse(payload.raw_payload) as PaddleWebhookEvent;
  const result = await processWebhookEvent(event);

  if (!result.ok) {
    throw new Error(
      `Webhook processing failed for ${result.event_type}: ${result.error}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `[WebhookWorker] Processed ${result.event_type} (event: ${payload.event_id})`,
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
  });

  return worker;
}
