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
import { createReprocessWebhooksWorker } from './reprocess-webhooks.worker';
import { createCleanupWorker } from './cleanup.worker';
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

if (!process.env.ADMIN_EMAILS) {
  // eslint-disable-next-line no-console
  console.error(
    '[Workers] WARNING: ADMIN_EMAILS is not set. The law monitor will detect ' +
    'statute changes and overdue KB reviews but send NO email — alerts will ' +
    'only appear in the admin dashboard. Set ADMIN_EMAILS (comma-separated) ' +
    'to receive them (e.g. legal@resolvaio.com,ops@resolvaio.com).',
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
const reprocessWebhooksWorker = createReprocessWebhooksWorker();
const cleanupWorker = createCleanupWorker();

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

/* ---- Schedule repeatable webhook reprocessing (every 3 minutes) ---- */
// Rel-M1: replays stored-but-unprocessed Polar webhooks so a transient blip
// during order.paid can't silently lose fulfillment.
async function scheduleReprocessWebhooks() {
  const queue = getQueue(QUEUE_NAMES.REPROCESS_WEBHOOKS);

  await queue.add(
    'reprocess-webhooks-repeatable',
    {},
    {
      repeat: {
        every: 3 * 60 * 1000, // 3 minutes
      },
      jobId: 'reprocess-webhooks-repeatable',
    },
  );

  // eslint-disable-next-line no-console
  console.log('[Workers] Webhook reprocessing scheduled every 3 minutes');
}

scheduleReprocessWebhooks().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Workers] Failed to schedule webhook reprocessing:', err);
});

/* ---- Schedule daily retention cleanup (03:30 UTC) ---- */
// Scale-H3: prune unbounded webhook_events (>90d) + loginAttempts (>30d).
async function scheduleCleanup() {
  const queue = getQueue(QUEUE_NAMES.CLEANUP);

  await queue.add(
    'cleanup-daily',
    {},
    {
      repeat: {
        pattern: '30 3 * * *', // Every day at 03:30 UTC
      },
      jobId: 'cleanup-daily',
    },
  );

  // eslint-disable-next-line no-console
  console.log('[Workers] Retention cleanup scheduled daily (03:30 UTC)');
}

scheduleCleanup().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[Workers] Failed to schedule retention cleanup:', err);
});

// eslint-disable-next-line no-console
console.log('[Workers] All workers started successfully');
// eslint-disable-next-line no-console
console.log('[Workers] Queues: email-delivery, deadline-check, webhook-process, letter-generate, sequence-generate, law-monitor, reprocess-webhooks, cleanup');

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
    reprocessWebhooksWorker.close(),
    cleanupWorker.close(),
  ]);

  await closeAllQueues();
  await closeRedis();

  // eslint-disable-next-line no-console
  console.log('[Workers] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
