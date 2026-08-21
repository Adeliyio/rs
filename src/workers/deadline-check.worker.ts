/**
 * Deadline check worker — processes deadline-check queue jobs.
 *
 * Polls Convex for due deadline events and fires prompts via email delivery.
 * Runs as a repeatable job (every 5 minutes). Uses the service Convex client
 * (workerConvex) — the replacement for the Supabase service-role client.
 */

import { Worker, type Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { getQueue } from '@/lib/queue/queues';
import { workerConvex, api } from '@/lib/convex/worker-client';
import type { Id } from '@convex/dataModel';
import type { EmailDeliveryJobPayload } from '@/types/jobs/email-delivery.job';

async function processDeadlineCheck(_job: Job): Promise<void> {
  const dueDeadlines = await workerConvex.query(api.service.getDueDeadlines, {});
  if (dueDeadlines.length === 0) return;

  // eslint-disable-next-line no-console
  console.log(`[DeadlineWorker] Found ${dueDeadlines.length} due deadline(s)`);

  const emailQueue = getQueue(QUEUE_NAMES.EMAIL_DELIVERY);

  for (const deadline of dueDeadlines) {
    const deadlineId = deadline.id as string;
    const caseId = deadline.case_id as string;
    const promptMessage = deadline.prompt_message as string;
    const deadlineDate = deadline.deadline_date as string;

    const caseRow = await workerConvex.query(api.service.getCase, {
      caseId: caseId as Id<'cases'>,
    });
    if (!caseRow) {
      // eslint-disable-next-line no-console
      console.warn(`[DeadlineWorker] Case ${caseId} not found for deadline ${deadlineId}`);
      continue;
    }

    const userEmail = await workerConvex.query(api.service.userEmailById, {
      userId: caseRow.user_id as Id<'users'>,
    });

    if (userEmail) {
      const emailPayload: EmailDeliveryJobPayload = {
        to: userEmail,
        subject: 'Deadline Approaching',
        template_id: 'deadline_prompt',
        template_data: {
          deadline_date: deadlineDate,
          days_remaining: '0',
          prompt_message: promptMessage,
          case_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/case/${caseId}`,
        },
      };
      await emailQueue.add(`deadline-email-${deadlineId}`, emailPayload, {
        jobId: `deadline-email-${deadlineId}`,
      });
    }

    await workerConvex.mutation(api.service.markDeadlineFired, {
      deadlineEventId: deadlineId as Id<'deadlineEvents'>,
    });

    // eslint-disable-next-line no-console
    console.log(`[DeadlineWorker] Fired deadline ${deadlineId} for case ${caseId}`);
  }
}

export function createDeadlineCheckWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(QUEUE_NAMES.DEADLINE_CHECK, processDeadlineCheck, {
    connection,
    concurrency: 1,
  });

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[DeadlineWorker] Check ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[DeadlineWorker] Check ${job?.id} failed:`, err.message);
  });

  return worker;
}
