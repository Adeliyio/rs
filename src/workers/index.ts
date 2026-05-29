/**
 * Worker entrypoint — starts all BullMQ workers.
 *
 * Run via: `node --import tsx src/workers/index.ts`
 * Or via docker-compose `worker` service.
 *
 * Workers run in a separate process from the Next.js app
 * and share the same Redis connection for BullMQ queues.
 */

import { getQueue } from '@/lib/queue/queues';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { createEmailDeliveryWorker } from './email-delivery.worker';
import { createDeadlineCheckWorker } from './deadline-check.worker';
import { createWebhookProcessWorker } from './webhook-process.worker';
import {
  createLetterGenerationWorker,
  createSequenceGenerationWorker,
} from './generation.worker';
import { createLawMonitorWorker } from './law-monitor.worker';
import { closeRedis } from '@/lib/redis';
import { closeAllQueues } from '@/lib/queue/queues';

/* ---- Startup checks ---- */
if (!process.env.APP_URL) {
  // eslint-disable-next-line no-console
  console.error(
    '[Workers] FATAL: APP_URL is not set. Email links will point to localhost. ' +
    'Set APP_URL in your environment (e.g., https://app.resolvaio.com).',
  );
}

if (!process.env.RESEND_API_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[Workers] FATAL: RESEND_API_KEY is not set. All emails will fail to send.',
  );
}

if (!process.env.REDIS_URL) {
  // eslint-disable-next-line no-console
  console.error(
    '[Workers] FATAL: REDIS_URL is not set. Queue connections will fail.',
  );
}

// eslint-disable-next-line no-console
console.log('[Workers] Starting all workers...');

/* ---- Create workers ---- */
const emailWorker = createEmailDeliveryWorker();
const deadlineWorker = createDeadlineCheckWorker();
const webhookWorker = createWebhookProcessWorker();
const letterGenWorker = createLetterGenerationWorker();
const sequenceGenWorker = createSequenceGenerationWorker();
const lawMonitorWorker = createLawMonitorWorker();

/* ---- Schedule repeatable deadline check (every 5 minutes) ---- */
async function scheduleDeadlineCheck() {
  const deadlineQueue = getQueue(QUEUE_NAMES.DEADLINE_CHECK);

  await deadlineQueue.add(
    'deadline-check-repeatable',
    {},
    {
      repeat: {
        every: 5 * 60 * 1000, // 5 minutes
      },
      jobId: 'deadline-check-repeatable',
    },
  );

  // eslint-disable-next-line no-console
  console.log('[Workers] Deadline check scheduled every 5 minutes');
}

scheduleDeadlineCheck().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Workers] Failed to schedule deadline check:', err);
});

/* ---- Schedule weekly law monitor (every 7 days, Sunday 2:00 AM UTC) ---- */
async function scheduleLawMonitor() {
  const lawMonitorQueue = getQueue(QUEUE_NAMES.LAW_MONITOR);

  await lawMonitorQueue.add(
    'law-monitor-weekly',
    { run_type: 'scheduled' },
    {
      repeat: {
        pattern: '0 2 * * 0', // Every Sunday at 2:00 AM UTC
      },
      jobId: 'law-monitor-weekly',
    },
  );

  // eslint-disable-next-line no-console
  console.log('[Workers] Law monitor scheduled weekly (Sunday 2:00 AM UTC)');
}

scheduleLawMonitor().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Workers] Failed to schedule law monitor:', err);
});

// eslint-disable-next-line no-console
console.log('[Workers] All workers started successfully');
// eslint-disable-next-line no-console
console.log('[Workers] Queues: email-delivery, deadline-check, webhook-process, letter-generate, sequence-generate, law-monitor');

/* ---- Graceful shutdown ---- */
async function shutdown() {
  // eslint-disable-next-line no-console
  console.log('[Workers] Shutting down...');

  await Promise.all([
    emailWorker.close(),
    deadlineWorker.close(),
    webhookWorker.close(),
    letterGenWorker.close(),
    sequenceGenWorker.close(),
    lawMonitorWorker.close(),
  ]);

  await closeAllQueues();
  await closeRedis();

  // eslint-disable-next-line no-console
  console.log('[Workers] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
