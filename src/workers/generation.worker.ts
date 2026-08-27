/**
 * Generation worker — processes letter and sequence generation jobs.
 *
 * Moves the expensive LLM generation from the API request path into
 * a background BullMQ job. The API route enqueues the job and returns
 * a job_id; the frontend polls for completion.
 *
 * PRD §8.4: generation queue with visible position.
 */

import { Worker, type Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { getRedis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue/config';
import { workerConvex, api } from '@/lib/convex/worker-client';
import type { Id } from '@convex/dataModel';
import { decryptAnswersPii } from '@/lib/crypto';
import { checkRefusal } from '@/lib/refusal/refusal-checker';
import {
  generateLetter,
  type DepositDiagnosticAnswers,
} from '@/features/deposit/generation/letter-generator';
import {
  generateSequence,
  type DiagnosticAnswers,
} from '@/features/subscription/generation/sequence-generator';
import { computeDeadlines } from '@/lib/deadlines/calculator';
import { scheduleDeadlines } from '@/lib/deadlines/scheduler';
import { loadKbEntry } from '@/lib/kb/loader';
import { enqueueLetterDeliveryEmail } from '@/lib/queue/enqueue';
import { AI_CONFIG } from '@/config/ai.config';
import { JURISDICTION_TIMEZONE } from '@/types/enums';
import type { DepositJurisdiction } from '@/types/enums';
import type { GenerationJobPayload } from '@/types/jobs/generation.job';
import type { DiagnosticState } from '@/types/diagnostic.types';
import type { Deduction, ItemizationStatus } from '@/lib/ai/deposit-generation';
import { Sentry } from '@/lib/sentry';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * A "skip" sentinel — the worker's guards mirror the /generate route's gates so
 * the async path is independently safe (R-3), not just safe-by-caller. Returns
 * null when generation must be skipped (already done, unpaid, refused).
 */
async function loadCaseData(caseId: string, userId: string) {
  const caseRow = (await workerConvex.query(api.service.getCase, {
    caseId: caseId as Id<'cases'>,
  })) as {
    id: string;
    user_id: string;
    wedge: string;
    jurisdiction: string;
    diagnostic_state: DiagnosticState | null;
    payment_status: string;
    status: string;
  } | null;

  if (!caseRow || caseRow.user_id !== userId) {
    throw new Error(`Case not found: ${caseId}`);
  }

  // R-3: independent guards, mirroring the /generate route.
  // 1. Idempotency — only generate from `intake`. If a prior run already flipped
  //    it to `generated` (or beyond), a letter/sequence exists; skip silently.
  if (caseRow.status !== 'intake') {
    // eslint-disable-next-line no-console
    console.log(`[GenerationWorker] Skip ${caseId}: status is '${caseRow.status}', not 'intake'.`);
    return { caseRow, skip: true as const };
  }
  // 2. Deposit paywall — never generate an unpaid deposit letter.
  if (caseRow.wedge === 'deposit' && caseRow.payment_status !== 'paid') {
    // eslint-disable-next-line no-console
    console.warn(`[GenerationWorker] Skip ${caseId}: deposit case is not paid.`);
    return { caseRow, skip: true as const };
  }

  return { caseRow, skip: false as const };
}

/* ------------------------------------------------------------------ */
/*  Deposit generation                                                */
/* ------------------------------------------------------------------ */

async function processDepositGeneration(
  caseId: string,
  userId: string,
): Promise<void> {
  const { caseRow, skip } = await loadCaseData(caseId, userId);
  if (skip) return;
  const answers = decryptAnswersPii(
    (caseRow.diagnostic_state?.answers ?? {}) as Record<string, unknown>,
  );

  // R-3: refusal re-check (mirrors the /generate route's hard-block gate).
  const refusal = checkRefusal(answers, 'deposit');
  if (refusal.triggered && refusal.severity === 'hard_block') {
    // eslint-disable-next-line no-console
    console.warn(`[GenerationWorker] Skip ${caseId}: refusal hard-block (${refusal.rule?.rule_id}).`);
    return;
  }

  const diagnosticAnswers: DepositDiagnosticAnswers = {
    wedge: 'deposit',
    jurisdiction: caseRow.jurisdiction,
    tenant_name: answers['tenant_name'] as string | undefined,
    property_address: answers['property_address'] as string | undefined,
    landlord_name: answers['landlord_name'] as string | undefined,
    landlord_address: answers['landlord_address'] as string | undefined,
    move_out_date: answers['move_out_date'] as string | undefined,
    lease_start_date: answers['lease_start_date'] as string | undefined,
    lease_end_date: answers['lease_end_date'] as string | undefined,
    original_deposit_amount: answers['original_deposit_amount'] as number | undefined,
    amount_returned: answers['amount_returned'] as number | undefined,
    amount_withheld: answers['amount_withheld'] as number | undefined,
    demand_amount: answers['demand_amount'] as number | undefined,
    days_since_move_out: answers['days_since_move_out'] as number | undefined,
    itemization_received: answers['itemization_received'] as boolean | undefined,
    itemization_status: answers['itemization_status'] as ItemizationStatus | undefined,
    forwarding_address_provided: answers['forwarding_address_provided'] as boolean | undefined,
    forwarding_address_date: answers['forwarding_address_date'] as string | undefined,
    walkthrough_completed: answers['walkthrough_completed'] as boolean | undefined,
    deductions: answers['deductions'] as Deduction[] | undefined,
    additional_context: answers['additional_context'] as string | undefined,
    ...answers,
  };

  const correlationId = randomUUID();
  const result = await generateLetter(caseId, diagnosticAnswers);

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  const generatedLetter = result.letter;

  await workerConvex.mutation(api.service.createLetter, {
    caseId: caseId as Id<'cases'>,
    content: generatedLetter.content,
    groundingContextIds: generatedLetter.grounding_context_ids,
    citationValidation: {
      valid: generatedLetter.citation_validation.valid,
      stripped: generatedLetter.citation_validation.stripped,
      pass: generatedLetter.citation_validation.pass,
    },
  });

  // Audit log
  await workerConvex.mutation(api.service.insertAudit, {
    caseId: caseId as Id<'cases'>,
    userId: userId as Id<'users'>,
    correlationId,
    groundingContextIds: generatedLetter.grounding_context_ids,
    modelVersion: AI_CONFIG.generation.model,
    promptVersion: 'deposit_v1',
    citationValidationResult: {
      valid_count: generatedLetter.citation_validation.valid.length,
      stripped_count: generatedLetter.citation_validation.stripped.length,
      pass: generatedLetter.citation_validation.pass,
    },
  });

  // Update case status → generated (records status history).
  await workerConvex.mutation(api.service.setCaseStatus, {
    caseId: caseId as Id<'cases'>,
    newStatus: 'generated',
  });

  // Schedule deadlines (best-effort)
  try {
    const kbEntry = loadKbEntry('deposit', caseRow.jurisdiction);
    const timezone =
      JURISDICTION_TIMEZONE[caseRow.jurisdiction as DepositJurisdiction] ??
      'America/New_York';
    const { deadlines } = computeDeadlines(
      kbEntry.deadline_rules,
      answers as Record<string, string | undefined>,
      timezone,
    );
    if (deadlines.length > 0) {
      await scheduleDeadlines(caseId, deadlines, timezone);
    }
  } catch (deadlineErr) {
    // eslint-disable-next-line no-console
    console.error('[GenerationWorker] Failed to schedule deadlines:', deadlineErr);
  }

  // Queue letter delivery email (best-effort)
  try {
    const userEmail = await workerConvex.query(api.service.userEmailById, {
      userId: userId as Id<'users'>,
    });
    if (userEmail) {
      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      const downloadUrl = `${appUrl}/case/${caseId}`;
      const propertyAddress = (answers['property_address'] as string) ?? 'your property';
      await enqueueLetterDeliveryEmail(
        userEmail,
        caseRow.jurisdiction,
        propertyAddress,
        downloadUrl,
        caseId,
      );
    }
  } catch (emailErr) {
    // eslint-disable-next-line no-console
    console.error('[GenerationWorker] Failed to enqueue letter delivery email:', emailErr);
  }
}

/* ------------------------------------------------------------------ */
/*  Subscription generation                                           */
/* ------------------------------------------------------------------ */

async function processSubscriptionGeneration(
  caseId: string,
  userId: string,
): Promise<void> {
  const { caseRow, skip } = await loadCaseData(caseId, userId);
  if (skip) return;
  const answers = decryptAnswersPii(
    (caseRow.diagnostic_state?.answers ?? {}) as Record<string, unknown>,
  );

  // R-3: refusal re-check (mirrors the /generate route's hard-block gate).
  const refusal = checkRefusal(answers, 'subscription');
  if (refusal.triggered && refusal.severity === 'hard_block') {
    // eslint-disable-next-line no-console
    console.warn(`[GenerationWorker] Skip ${caseId}: refusal hard-block (${refusal.rule?.rule_id}).`);
    return;
  }

  const diagnosticAnswers: DiagnosticAnswers = {
    wedge: 'subscription',
    jurisdiction: caseRow.jurisdiction,
    vertical: answers['vertical'] as DiagnosticAnswers['vertical'],
    company_name: answers['company_name'] as string | undefined,
    service_type: answers['service_type'] as string | undefined,
    account_identifier: answers['account_identifier'] as string | undefined,
    cancellation_barriers: answers['cancellation_barriers'] as string[] | undefined,
    additional_details: answers['additional_details'] as string | undefined,
    ...answers,
  };

  const correlationId = randomUUID();
  const result = await generateSequence(caseId, diagnosticAnswers);

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  const generatedSequence = result.sequence;

  await workerConvex.mutation(api.service.createSequence, {
    caseId: caseId as Id<'cases'>,
    vertical: generatedSequence.vertical,
    steps: {
      steps: generatedSequence.steps,
      jurisdiction: generatedSequence.jurisdiction,
      sent_dates: {},
    },
    groundingContextIds: generatedSequence.grounding_context_ids,
    citationValidation: {
      valid: generatedSequence.citation_validation.valid,
      stripped: generatedSequence.citation_validation.stripped,
      pass: generatedSequence.citation_validation.pass,
    },
  });

  // Audit log
  await workerConvex.mutation(api.service.insertAudit, {
    caseId: caseId as Id<'cases'>,
    userId: userId as Id<'users'>,
    correlationId,
    groundingContextIds: generatedSequence.grounding_context_ids,
    modelVersion: AI_CONFIG.generation.model,
    promptVersion: 'subscription_v1',
    citationValidationResult: {
      valid_count: generatedSequence.citation_validation.valid.length,
      stripped_count: generatedSequence.citation_validation.stripped.length,
      pass: generatedSequence.citation_validation.pass,
    },
  });

  // Update case status → generated (records status history).
  await workerConvex.mutation(api.service.setCaseStatus, {
    caseId: caseId as Id<'cases'>,
    newStatus: 'generated',
  });
}

/* ------------------------------------------------------------------ */
/*  Worker processor                                                  */
/* ------------------------------------------------------------------ */

async function processGenerationJob(
  job: Job<GenerationJobPayload>,
): Promise<void> {
  const { case_id, user_id, wedge } = job.data;

  // eslint-disable-next-line no-console
  console.log(
    `[GenerationWorker] Processing ${wedge} generation for case ${case_id}`,
  );

  if (wedge === 'deposit') {
    await processDepositGeneration(case_id, user_id);
  } else if (wedge === 'subscription') {
    await processSubscriptionGeneration(case_id, user_id);
  } else {
    throw new Error(`Unsupported wedge: ${wedge}`);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[GenerationWorker] Completed ${wedge} generation for case ${case_id}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Factory                                                           */
/* ------------------------------------------------------------------ */

export function createLetterGenerationWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(
    QUEUE_NAMES.LETTER_GENERATE,
    processGenerationJob,
    {
      connection,
      concurrency: 3, // Limit concurrent LLM calls
    },
  );

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[GenerationWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[GenerationWorker] Job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { tags: { area: 'letter-generation' } });
  });

  return worker;
}

export function createSequenceGenerationWorker(): Worker {
  const connection = getRedis();

  const worker = new Worker(
    QUEUE_NAMES.SEQUENCE_GENERATE,
    processGenerationJob,
    {
      connection,
      concurrency: 3,
    },
  );

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[GenerationWorker] Sequence job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[GenerationWorker] Sequence job ${job?.id} failed:`, err.message);
    Sentry.captureException(err, { tags: { area: 'sequence-generation' } });
  });

  return worker;
}
