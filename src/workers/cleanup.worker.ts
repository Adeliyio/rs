/**
 * Retention cleanup worker — deletes aged rows from unbounded tables.
 *
 * Two tables grow without bound in normal operation:
 *  - webhookEvents: one row per Polar delivery, kept for idempotency + audit.
 *  - loginAttempts: one row per auth attempt, kept for abuse analysis.
 *
 * This repeatable job (daily) deletes webhookEvents older than 90 days and
 * loginAttempts older than 30 days. Deletes are batched server-side (~100 per
 * mutation) to keep each Convex transaction short; we loop a bounded number of
 * batches per run so a large backlog drains over several days rather than in one
 * long-running run. Uses the service Convex client (workerConvex).
 */

import { Worker, type Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { workerConvex, api } from '@/lib/convex/worker-client';
import { Sentry } from '@/lib/sentry';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_RETENTION_MS = 90 * DAY_MS;
const LOGIN_ATTEMPT_RETENTION_MS = 30 * DAY_MS;
const BATCH_SIZE = 100;
/** Cap batches per run so one run can't hold the worker for an unbounded time. */
const MAX_BATCHES_PER_RUN = 50;

async function deleteAged(
  label: string,
  run: (olderThanMs: number, limit: number) => Promise<number>,
  retentionMs: number,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const deleted = await run(retentionMs, BATCH_SIZE);
    total += deleted;
    if (deleted < BATCH_SIZE) break; // drained
  }
  // eslint-disable-next-line no-console
  console.log(`[Cleanup] Deleted ${total} aged ${label} row(s)`);
  return total;
}

async function processCleanup(_job: Job): Promise<void> {
  await deleteAged(
    'webhookEvents',
    (olderThanMs, limit) =>
      workerConvex.mutation(api.service.deleteOldWebhooks, { olderThanMs, limit }),
    WEBHOOK_RETENTION_MS,
  );

  await deleteAged(
    'loginAttempts',
    (olderThanMs, limit) =>
      workerConvex.mutation(api.service.deleteOldLoginAttempts, { olderThanMs, limit }),
    LOGIN_ATTEMPT_RETENTION_MS,
  );
}

export function createCleanupWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(QUEUE_NAMES.CLEANUP, processCleanup, {
    connection,
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[Cleanup] Run ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[Cleanup] Run ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { tags: { area: 'cleanup' } });
  });

  return worker;
}
