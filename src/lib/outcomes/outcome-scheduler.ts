/**
 * Outcome email scheduler — server-only.
 *
 * Schedules T+14, T+30, and T+60 outcome follow-up emails when
 * a case transitions to 'sent' status. Uses BullMQ delayed jobs
 * so emails fire at the right time without a polling loop.
 */

import { getQueue } from '@/lib/queue/queues';
import { QUEUE_NAMES } from '@/lib/queue/config';
import type { EmailDeliveryJobPayload } from '@/types/jobs/email-delivery.job';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const OUTCOME_PROMPTS = [
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Main function                                                     */
/* ------------------------------------------------------------------ */

/**
 * Schedules outcome follow-up emails for a case.
 * Call this when a case transitions to 'sent' status.
 *
 * @param caseId  The case ID.
 * @param userEmail  The user's email address.
 * @param appUrl  The base app URL for linking.
 */
export async function scheduleOutcomeEmails(
  caseId: string,
  userEmail: string,
  appUrl: string,
): Promise<{ scheduled: number }> {
  const queue = getQueue(QUEUE_NAMES.OUTCOME_FOLLOWUP);
  let scheduled = 0;

  for (const prompt of OUTCOME_PROMPTS) {
    const delayMs = prompt.days * MS_PER_DAY;

    const payload: EmailDeliveryJobPayload = {
      to: userEmail,
      subject: 'How Did It Go? Share Your Outcome',
      template_id: 'outcome_followup',
      template_data: {
        days_elapsed: String(prompt.days),
        outcome_url: `${appUrl}/case/${caseId}`,
      },
    };

    await queue.add(
      `outcome-followup-${caseId}-${prompt.days}d`,
      payload,
      {
        jobId: `outcome-${caseId}-${prompt.days}d`,
        delay: delayMs,
      },
    );

    scheduled++;
  }

  return { scheduled };
}

/**
 * Cancels scheduled outcome emails for a case.
 * Call when a case is resolved or closed before all prompts fire.
 */
export async function cancelOutcomeEmails(
  caseId: string,
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.OUTCOME_FOLLOWUP);

  for (const prompt of OUTCOME_PROMPTS) {
    const jobId = `outcome-${caseId}-${prompt.days}d`;
    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch {
      // Job may not exist or already completed — safe to ignore
    }
  }
}

export { OUTCOME_PROMPTS };
