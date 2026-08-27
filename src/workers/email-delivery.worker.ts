/**
 * Email delivery worker — processes email-delivery queue jobs.
 *
 * Renders templates and sends emails via Resend.
 * Handles retries internally (Resend client has 3x backoff).
 * BullMQ provides additional retry on worker-level failure.
 */

import { Worker, type Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { sendTemplatedEmail } from '@/lib/email/sender';
import {
  emailDeliveryJobSchema,
  type EmailDeliveryJobPayload,
} from '@/types/jobs/email-delivery.job';
import type { TemplateId } from '@/lib/email/templates';
import { Sentry } from '@/lib/sentry';

async function processEmailDelivery(
  job: Job<EmailDeliveryJobPayload>,
): Promise<void> {
  const payload = emailDeliveryJobSchema.parse(job.data);

  const result = await sendTemplatedEmail(
    payload.to,
    payload.template_id as TemplateId,
    payload.template_data,
    payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      content_type: a.content_type,
    })),
  );

  if (!result.ok) {
    throw new Error(`Email delivery failed: ${result.error}`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[EmailWorker] Sent email ${result.id} to ${payload.to} (template: ${payload.template_id})`,
  );
}

export function createEmailDeliveryWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(
    QUEUE_NAMES.EMAIL_DELIVERY, // R-6: dedicated transactional-email queue
    processEmailDelivery,
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // 10 emails/second max
      },
    },
  );

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[EmailWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { tags: { area: 'email-delivery' } });
  });

  return worker;
}
