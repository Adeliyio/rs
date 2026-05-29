/**
 * Job enqueue helpers — server-only.
 *
 * Provides typed functions for adding jobs to BullMQ queues.
 * Used by API routes and other server code to dispatch async work.
 */

import { getQueue } from '@/lib/queue/queues';
import { QUEUE_NAMES } from '@/lib/queue/config';
import type { EmailDeliveryJobPayload } from '@/types/jobs/email-delivery.job';
import type { DeadlinePromptJobPayload } from '@/types/jobs/deadline-prompt.job';
import type { WebhookProcessingJobPayload } from '@/types/jobs/webhook-processing.job';
import type { LawMonitorJobPayload } from '@/types/jobs/law-monitor.job';

/* ------------------------------------------------------------------ */
/*  Email delivery                                                    */
/* ------------------------------------------------------------------ */

/**
 * Enqueues an email for delivery via the email worker.
 *
 * @param payload  Email delivery job data.
 * @param idempotencyKey  Optional key to prevent duplicate sends.
 */
export async function enqueueEmailDelivery(
  payload: EmailDeliveryJobPayload,
  idempotencyKey?: string,
): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.OUTCOME_FOLLOWUP);
  const job = await queue.add('email-delivery', payload, {
    jobId: idempotencyKey,
  });
  return job.id ?? 'unknown';
}

/**
 * Enqueues a letter delivery email with optional PDF attachment.
 */
export async function enqueueLetterDeliveryEmail(
  to: string,
  jurisdiction: string,
  propertyAddress: string,
  downloadUrl: string,
  caseId: string,
): Promise<string> {
  return enqueueEmailDelivery(
    {
      to,
      subject: `Your Demand Letter for ${propertyAddress} Is Ready`,
      template_id: 'letter_delivery',
      template_data: {
        jurisdiction,
        property_address: propertyAddress,
        download_url: downloadUrl,
      },
    },
    `letter-delivery-${caseId}`,
  );
}

/**
 * Enqueues a sequence step reminder email.
 */
export async function enqueueSequenceStepEmail(
  to: string,
  stepNumber: number,
  stepName: string,
  companyName: string,
  caseId: string,
  caseUrl: string,
): Promise<string> {
  return enqueueEmailDelivery(
    {
      to,
      subject: `Action Needed: Send Email ${stepNumber} to ${companyName}`,
      template_id: 'sequence_step',
      template_data: {
        step_number: String(stepNumber),
        step_name: stepName,
        company_name: companyName,
        case_url: caseUrl,
      },
    },
    `sequence-step-${caseId}-${stepNumber}`,
  );
}

/**
 * Enqueues an outcome follow-up email.
 */
export async function enqueueOutcomeFollowupEmail(
  to: string,
  daysElapsed: number,
  caseId: string,
  outcomeUrl: string,
): Promise<string> {
  return enqueueEmailDelivery(
    {
      to,
      subject: 'How Did It Go? Share Your Outcome',
      template_id: 'outcome_followup',
      template_data: {
        days_elapsed: String(daysElapsed),
        outcome_url: outcomeUrl,
      },
    },
    `outcome-followup-${caseId}-${daysElapsed}d`,
  );
}

/**
 * Enqueues a payment confirmation email.
 */
export async function enqueuePaymentConfirmationEmail(
  to: string,
  amount: string,
  productName: string,
  caseId: string,
  caseUrl: string,
): Promise<string> {
  return enqueueEmailDelivery(
    {
      to,
      subject: `Payment Confirmed — ${productName}`,
      template_id: 'payment_confirmation',
      template_data: {
        amount,
        product_name: productName,
        case_url: caseUrl,
      },
    },
    `payment-confirmation-${caseId}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Letter / sequence generation                                      */
/* ------------------------------------------------------------------ */

/**
 * Enqueues a letter generation job.
 * Returns the BullMQ job ID for status polling.
 */
export async function enqueueLetterGeneration(
  caseId: string,
  userId: string,
  wedge: 'deposit' | 'subscription',
  jurisdiction: string,
): Promise<string> {
  const queueName =
    wedge === 'deposit'
      ? QUEUE_NAMES.LETTER_GENERATE
      : QUEUE_NAMES.SEQUENCE_GENERATE;

  const queue = getQueue(queueName);
  const job = await queue.add(
    `${wedge}-generation`,
    {
      case_id: caseId,
      user_id: userId,
      wedge,
      jurisdiction,
      idempotency_key: `gen-${caseId}`,
    },
    { jobId: `gen-${caseId}` },
  );
  return job.id ?? 'unknown';
}

/**
 * Returns the total number of waiting + active jobs in both generation queues.
 * Used by the circuit breaker to decide whether to go async-only.
 */
export async function getGenerationQueueDepth(): Promise<number> {
  const letterQueue = getQueue(QUEUE_NAMES.LETTER_GENERATE);
  const seqQueue = getQueue(QUEUE_NAMES.SEQUENCE_GENERATE);

  const [letterWaiting, letterActive, seqWaiting, seqActive] =
    await Promise.all([
      letterQueue.getWaitingCount(),
      letterQueue.getActiveCount(),
      seqQueue.getWaitingCount(),
      seqQueue.getActiveCount(),
    ]);

  return letterWaiting + letterActive + seqWaiting + seqActive;
}

/**
 * Returns the position of a specific job in its queue (0-based).
 * Returns -1 if the job is active or not found.
 */
export async function getJobQueuePosition(
  jobId: string,
  wedge: 'deposit' | 'subscription',
): Promise<{ position: number; state: string }> {
  const queueName =
    wedge === 'deposit'
      ? QUEUE_NAMES.LETTER_GENERATE
      : QUEUE_NAMES.SEQUENCE_GENERATE;

  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    return { position: -1, state: 'not_found' };
  }

  const state = await job.getState();

  if (state === 'waiting') {
    const waiting = await queue.getWaiting();
    const idx = waiting.findIndex((j) => j.id === jobId);
    return { position: idx >= 0 ? idx + 1 : -1, state };
  }

  return { position: 0, state };
}

/* ------------------------------------------------------------------ */
/*  Deadline prompt                                                   */
/* ------------------------------------------------------------------ */

/**
 * Enqueues a deadline prompt notification.
 */
export async function enqueueDeadlinePrompt(
  payload: DeadlinePromptJobPayload,
): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.DEADLINE_CHECK);
  const job = await queue.add('deadline-prompt', payload, {
    jobId: `deadline-${payload.deadline_event_id}`,
  });
  return job.id ?? 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Webhook processing                                                */
/* ------------------------------------------------------------------ */

/**
 * Enqueues a webhook event for async processing.
 */
export async function enqueueWebhookProcessing(
  payload: WebhookProcessingJobPayload,
): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.WEBHOOK_PROCESS);
  const job = await queue.add('webhook-process', payload, {
    jobId: `webhook-${payload.event_id}`,
  });
  return job.id ?? 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Law monitor                                                       */
/* ------------------------------------------------------------------ */

/**
 * Enqueues a law monitor run (manual trigger from admin dashboard).
 * For scheduled runs, the repeatable job is configured in workers/index.ts.
 */
export async function enqueueLawMonitorRun(
  payload: LawMonitorJobPayload,
): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.LAW_MONITOR);
  const jobId = payload.run_type === 'manual'
    ? `law-monitor-manual-${Date.now()}`
    : `law-monitor-scheduled-${Date.now()}`;

  const job = await queue.add('law-monitor', payload, { jobId });
  return job.id ?? 'unknown';
}
