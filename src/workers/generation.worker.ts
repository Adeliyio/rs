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
  normalizeDepositAnswers,
  depositDemandIsValid,
} from '@/features/deposit/generation/normalize-answers';
import {
  generateSequence,
  type DiagnosticAnswers,
} from '@/features/subscription/generation/sequence-generator';
import { normalizeSubscriptionAnswers } from '@/features/diagnostic/anonymous/anonymous-answers';
import { computeDeadlines } from '@/lib/deadlines/calculator';
import { scheduleDeadlines } from '@/lib/deadlines/scheduler';
import { loadKbEntry } from '@/lib/kb/loader';
import { enqueueLetterDeliveryEmail } from '@/lib/queue/enqueue';
import { refundOrder } from '@/lib/payments/auto-refund';
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
  // 2. Deposit paywall — generate only if the case is paid OR the owner has an
  //    active subscription (Unlimited). Mirrors the /generate route's dual gate;
  //    subscription cases are NEVER marked payment_status:'paid', so a paid-only
  //    check silently stranded every Unlimited subscriber during a queue spike.
  if (caseRow.wedge === 'deposit' && caseRow.payment_status !== 'paid') {
    const entitled = await workerConvex.query(api.service.hasActiveSubscription, {
      userId: caseRow.user_id as Id<'users'>,
    });
    if (!entitled) {
      // eslint-disable-next-line no-console
      console.warn(`[GenerationWorker] Skip ${caseId}: deposit case not paid and no active subscription.`);
      return { caseRow, skip: true as const };
    }
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
  const rawAnswers = decryptAnswersPii(
    (caseRow.diagnostic_state?.answers ?? {}) as Record<string, unknown>,
  );

  // R-3: refusal re-check (mirrors the /generate route's hard-block gate).
  const refusal = checkRefusal(rawAnswers, 'deposit');
  if (refusal.triggered && refusal.severity === 'hard_block') {
    // eslint-disable-next-line no-console
    console.warn(`[GenerationWorker] Skip ${caseId}: refusal hard-block (${refusal.rule?.rule_id}).`);
    return;
  }

  // Fetch the owner's name so the letter isn't signed "[YOUR NAME]".
  const owner = await workerConvex.query(api.service.userById, {
    userId: caseRow.user_id as Id<'users'>,
  });
  const ownerName: string =
    (owner?.name as string | undefined) ??
    (owner?.email as string | undefined)?.split('@')[0] ??
    '';

  // Same normalization the sync route uses — group flatten, key renames, boolean
  // coercion, money derivation, tenant_name fill. Without this the worker (the
  // recovery / queue-spike path) shipped "[LANDLORD NAME]" / "$0" letters.
  const answers = normalizeDepositAnswers(rawAnswers, { userName: ownerName });

  // Never generate a $0 demand from the background path either — fail the job so
  // it retries / surfaces, rather than delivering junk to a paying customer.
  if (!depositDemandIsValid(answers)) {
    throw new Error(`[GenerationWorker] ${caseId}: could not derive a positive demand amount`);
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

  // Replace any residual [YOUR NAME] / [DATE] the model emitted.
  const letterToday = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const finalContent = generatedLetter.content
    .replace(/\[YOUR NAME\]/gi, ownerName)
    .replace(/\[YOUR FULL NAME\]/gi, ownerName)
    .replace(/\[FULL NAME\]/gi, ownerName)
    .replace(/\[NAME\]/gi, ownerName)
    .replace(/\[DATE\]/gi, letterToday)
    .replace(/\[TODAY'S DATE\]/gi, letterToday)
    .replace(/\[CURRENT DATE\]/gi, letterToday);

  await workerConvex.mutation(api.service.createLetter, {
    caseId: caseId as Id<'cases'>,
    content: finalContent,
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
  const rawAnswers = decryptAnswersPii(
    (caseRow.diagnostic_state?.answers ?? {}) as Record<string, unknown>,
  );
  // Same normalization the sync route uses (generate/route.ts) — flatten group
  // nodes + coerce boolean-by-node-id keys. Skipping it here meant the
  // background/queue-spike path shipped cancellation emails missing the charge
  // amount, dates, and the refund request the user entered.
  const answers = normalizeSubscriptionAnswers(rawAnswers);

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

    // Rel-H3: on TERMINAL failure (all attempts exhausted) of a PAID deposit
    // case, refund the customer rather than leaving them charged with no letter
    // forever. Best-effort and guarded — never throw out of the event handler.
    void handleTerminalGenerationFailure(job).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[GenerationWorker] terminal-failure recovery errored:', e);
    });
  });

  return worker;
}

/**
 * When a generation job has exhausted all attempts, protect a paying deposit
 * customer: refund the order (if any) and close the case. Subscription-covered
 * failures have no order to refund — alert ops instead. Idempotent-ish: only
 * acts on a case still in 'intake' with payment_status 'paid'.
 */
async function handleTerminalGenerationFailure(
  job: Job<GenerationJobPayload> | undefined,
): Promise<void> {
  if (!job) return;
  // Only act once retries are truly exhausted.
  const maxAttempts = job.opts?.attempts ?? 1;
  if ((job.attemptsMade ?? 0) < maxAttempts) return;

  const { case_id: caseId, wedge } = job.data;
  if (wedge !== 'deposit') return;

  const caseRow = await workerConvex.query(api.service.getCase, {
    caseId: caseId as Id<'cases'>,
  });
  if (!caseRow) return;
  // Only a paid case still awaiting its letter needs rescuing.
  if (caseRow.payment_status !== 'paid' || caseRow.status !== 'intake') return;

  const orderId = (caseRow as { polar_order_id?: string | null }).polar_order_id;
  if (orderId) {
    const refund = await refundOrder(
      caseId,
      orderId,
      'Refund: letter generation failed after payment (all retries exhausted).',
    );
    if (!refund.refunded) {
      Sentry.captureException(
        new Error(`Paid case ${caseId}: generation failed AND refund failed — manual review`),
        { tags: { area: 'letter-generation-recovery' } },
      );
    }
  } else {
    // Subscription-covered (no order to refund) — surface for ops follow-up.
    Sentry.captureException(
      new Error(`Subscription case ${caseId}: generation failed terminally, no order to refund — manual retry needed`),
      { tags: { area: 'letter-generation-recovery' } },
    );
  }
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
