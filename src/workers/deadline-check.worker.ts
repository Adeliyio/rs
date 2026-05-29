/**
 * Deadline check worker — processes deadline-check queue jobs.
 *
 * Polls for due deadline events and fires prompts via in-app
 * notification + email delivery. Runs as a repeatable job
 * (every 5 minutes).
 */

import { Worker, type Job } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { getQueue } from '@/lib/queue/queues';
import { getDueDeadlines, markDeadlineFired } from '@/lib/deadlines/scheduler';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { EmailDeliveryJobPayload } from '@/types/jobs/email-delivery.job';

async function processDeadlineCheck(
  _job: Job,
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Fetch all due, unfired, undismissed deadlines
  const dueDeadlines = await getDueDeadlines(supabase);

  if (dueDeadlines.length === 0) return;

  // eslint-disable-next-line no-console
  console.log(`[DeadlineWorker] Found ${dueDeadlines.length} due deadline(s)`);

  const emailQueue = getQueue(QUEUE_NAMES.OUTCOME_FOLLOWUP);

  for (const deadline of dueDeadlines) {
    const deadlineId = deadline['id'] as string;
    const caseId = deadline['case_id'] as string;
    const promptMessage = deadline['prompt_message'] as string;
    const deadlineDate = deadline['deadline_date'] as string;

    // Look up the user's email for this case
    const { data: caseData } = await supabase
      .from('cases')
      .select('user_id')
      .eq('id', caseId)
      .single();

    if (!caseData) {
      // eslint-disable-next-line no-console
      console.warn(`[DeadlineWorker] Case ${caseId} not found for deadline ${deadlineId}`);
      continue;
    }

    const userId = (caseData as unknown as { user_id: string }).user_id;

    // Look up user email from Supabase Auth
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;

    if (userEmail) {
      // Enqueue email delivery
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

      await emailQueue.add(
        `deadline-email-${deadlineId}`,
        emailPayload,
        { jobId: `deadline-email-${deadlineId}` }, // Idempotent
      );
    }

    // Mark deadline as fired
    await markDeadlineFired(supabase, deadlineId);

    // eslint-disable-next-line no-console
    console.log(`[DeadlineWorker] Fired deadline ${deadlineId} for case ${caseId}`);
  }
}

export function createDeadlineCheckWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(
    QUEUE_NAMES.DEADLINE_CHECK,
    processDeadlineCheck,
    {
      connection,
      concurrency: 1, // Single-threaded check
    },
  );

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
