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
import { createServiceRoleClient } from '@/lib/supabase/service-role';
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function loadCaseData(caseId: string, userId: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('cases')
    .select('id, user_id, wedge, jurisdiction, diagnostic_state, payment_status, status')
    .eq('id', caseId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error(`Case not found: ${caseId}`);
  }

  return {
    supabase,
    caseRow: data as unknown as {
      id: string;
      user_id: string;
      wedge: string;
      jurisdiction: string;
      diagnostic_state: DiagnosticState | null;
      payment_status: string;
      status: string;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Deposit generation                                                */
/* ------------------------------------------------------------------ */

async function processDepositGeneration(
  caseId: string,
  userId: string,
): Promise<void> {
  const { supabase, caseRow } = await loadCaseData(caseId, userId);
  const answers = (caseRow.diagnostic_state?.answers ?? {}) as Record<string, unknown>;

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

  const letterPayload: Record<string, unknown> = {
    case_id: caseId,
    content: generatedLetter.content,
    pdf_url: null,
    grounding_context_ids: generatedLetter.grounding_context_ids,
    citation_validation: {
      valid: generatedLetter.citation_validation.valid,
      stripped: generatedLetter.citation_validation.stripped,
      pass: generatedLetter.citation_validation.pass,
    },
  };

  const { error: letterError } = await supabase
    .from('letters')
    // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
    .insert(letterPayload)
    .select()
    .single();

  if (letterError) {
    throw new Error(`Failed to save letter: ${letterError.message}`);
  }

  // Audit log
  const auditPayload: Record<string, unknown> = {
    case_id: caseId,
    user_id: userId,
    correlation_id: correlationId,
    grounding_context_ids: generatedLetter.grounding_context_ids,
    model_version: AI_CONFIG.generation.model,
    prompt_version: 'deposit_v1',
    citation_validation_result: {
      valid_count: generatedLetter.citation_validation.valid.length,
      stripped_count: generatedLetter.citation_validation.stripped.length,
      pass: generatedLetter.citation_validation.pass,
    },
  };
  // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
  await supabase.from('audit_log').insert(auditPayload);

  // Update case status
  const caseUpdatePayload: Record<string, unknown> = {
    status: 'generated',
    updated_at: new Date().toISOString(),
  };
  // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type
  await supabase.from('cases').update(caseUpdatePayload).eq('id', caseId);

  const historyPayload: Record<string, unknown> = {
    case_id: caseId,
    previous_status: caseRow.status,
    new_status: 'generated',
  };
  // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
  await supabase.from('case_status_history').insert(historyPayload);

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
      await scheduleDeadlines(supabase, caseId, deadlines, timezone);
    }
  } catch (deadlineErr) {
    // eslint-disable-next-line no-console
    console.error('[GenerationWorker] Failed to schedule deadlines:', deadlineErr);
  }

  // Queue letter delivery email (best-effort)
  try {
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;
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
  const { supabase, caseRow } = await loadCaseData(caseId, userId);
  const answers = (caseRow.diagnostic_state?.answers ?? {}) as Record<string, unknown>;

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

  const sequencePayload: Record<string, unknown> = {
    case_id: caseId,
    vertical: generatedSequence.vertical,
    current_step: 1,
    next_send_at: null,
    steps: {
      steps: generatedSequence.steps,
      jurisdiction: generatedSequence.jurisdiction,
      sent_dates: {},
    },
    grounding_context_ids: generatedSequence.grounding_context_ids,
    citation_validation: {
      valid: generatedSequence.citation_validation.valid,
      stripped: generatedSequence.citation_validation.stripped,
      pass: generatedSequence.citation_validation.pass,
    },
  };

  const { error: seqError } = await supabase
    .from('sequences')
    // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
    .insert(sequencePayload)
    .select()
    .single();

  if (seqError) {
    throw new Error(`Failed to save sequence: ${seqError.message}`);
  }

  // Audit log
  const auditPayload: Record<string, unknown> = {
    case_id: caseId,
    user_id: userId,
    correlation_id: correlationId,
    grounding_context_ids: generatedSequence.grounding_context_ids,
    model_version: AI_CONFIG.generation.model,
    prompt_version: 'subscription_v1',
    citation_validation_result: {
      valid_count: generatedSequence.citation_validation.valid.length,
      stripped_count: generatedSequence.citation_validation.stripped.length,
      pass: generatedSequence.citation_validation.pass,
    },
  };
  // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
  await supabase.from('audit_log').insert(auditPayload);

  // Update case status
  const caseUpdatePayload: Record<string, unknown> = {
    status: 'generated',
    updated_at: new Date().toISOString(),
  };
  // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type
  await supabase.from('cases').update(caseUpdatePayload).eq('id', caseId);

  const historyPayload: Record<string, unknown> = {
    case_id: caseId,
    previous_status: caseRow.status,
    new_status: 'generated',
  };
  // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
  await supabase.from('case_status_history').insert(historyPayload);
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
  });

  return worker;
}
