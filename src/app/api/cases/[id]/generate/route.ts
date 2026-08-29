/**
 * POST /api/cases/[id]/generate
 *
 * Triggers generation for a case. Supports both wedges:
 * - subscription: generates a 3-step email sequence
 * - deposit: generates a demand letter
 *
 * Validates: authenticated user, case belongs to user, case status is
 * 'intake', diagnostic is complete, refusal check passes.
 * For deposit: also validates payment_status === 'paid' (or subscription active).
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { q, m, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import type { Id } from '@convex/dataModel';
import { decryptAnswersPii } from '@/lib/crypto';
import { checkRefusal } from '@/lib/refusal/refusal-checker';
import {
  generateSequence,
  type DiagnosticAnswers,
} from '@/features/subscription/generation/sequence-generator';
import {
  generateLetter,
  type DepositDiagnosticAnswers,
} from '@/features/deposit/generation/letter-generator';
import { AI_CONFIG } from '@/config/ai.config';
import {
  enqueueLetterDeliveryEmail,
  enqueueLetterGeneration,
  getGenerationQueueDepth,
} from '@/lib/queue/enqueue';
import { processAutoRefundIfNeeded } from '@/lib/payments/auto-refund';
import { Sentry } from '@/lib/sentry';
import { computeDeadlines } from '@/lib/deadlines/calculator';
import { scheduleDeadlines } from '@/lib/deadlines/scheduler';
import { loadKbEntry } from '@/lib/kb/loader';
import { DEPOSIT_JURISDICTION, JURISDICTION_TIMEZONE, type DepositJurisdiction } from '@/types/enums';
import type { DiagnosticState } from '@/types/diagnostic.types';
import type { Deduction, ItemizationStatus } from '@/lib/ai/deposit-generation';
import type { GeneratedSequence } from '@/types/generation.types';

/** Trusted service Convex client type for the generation writes. */
type ServiceConvex = ReturnType<typeof createServiceConvexClient>;

/**
 * Circuit breaker threshold: if total generation jobs in the queue
 * exceed this value, enqueue the job instead of processing synchronously,
 * and tell the user to check their email.
 *
 * PRD §8.4: circuit breaker for viral-spike survival.
 */
const CIRCUIT_BREAKER_THRESHOLD = 50;

/** User identity info for personalizing generated content. */
interface UserInfo {
  fullName: string;
  email: string;
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface CaseRow {
  id: string;
  user_id: string;
  status: string;
  wedge: string;
  jurisdiction: string;
  diagnostic_state: Record<string, unknown> | null;
  payment_status: string;
  polar_order_id?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Shared helpers (service Convex client — trusted writes)           */
/* ------------------------------------------------------------------ */

async function createAuditEntry(
  convex: ServiceConvex,
  args: {
    caseId: string;
    userId: string;
    correlationId: string;
    groundingContextIds: string[];
    modelVersion: string;
    promptVersion: string;
    citationValidationResult: Record<string, unknown>;
  },
) {
  try {
    await convex.mutation(api.service.insertAudit, {
      secret: serviceSecret(),
      caseId: args.caseId as Id<'cases'>,
      userId: args.userId as Id<'users'>,
      correlationId: args.correlationId,
      groundingContextIds: args.groundingContextIds,
      modelVersion: args.modelVersion,
      promptVersion: args.promptVersion,
      citationValidationResult: args.citationValidationResult,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to create audit_log entry:', err);
  }
}

async function updateCaseStatus(convex: ServiceConvex, caseId: string) {
  try {
    // Records the status-history row too.
    await convex.mutation(api.service.setCaseStatus, {
      secret: serviceSecret(),
      caseId: caseId as Id<'cases'>,
      newStatus: 'generated',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to update case status to generated:', err);
  }
}

/**
 * Replace LLM placeholders ([YOUR NAME], [YOUR EMAIL], [DATE]) in
 * generated email bodies and subjects with actual user data.
 */
function personalizeSequenceSteps(
  steps: GeneratedSequence['steps'],
  userInfo: UserInfo,
): GeneratedSequence['steps'] {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return steps.map((step) => ({
    ...step,
    subject: replaceUserPlaceholders(step.subject, userInfo, today),
    body: replaceUserPlaceholders(step.body, userInfo, today),
  }));
}

function replaceUserPlaceholders(
  text: string,
  userInfo: UserInfo,
  today: string,
): string {
  return text
    .replace(/\[YOUR NAME\]/gi, userInfo.fullName)
    .replace(/\[YOUR EMAIL\]/gi, userInfo.email)
    .replace(/\[DATE\]/gi, today)
    .replace(/\[YOUR FULL NAME\]/gi, userInfo.fullName)
    .replace(/\[FULL NAME\]/gi, userInfo.fullName)
    .replace(/\[NAME\]/gi, userInfo.fullName)
    .replace(/\[EMAIL\]/gi, userInfo.email)
    .replace(/\[EMAIL ADDRESS\]/gi, userInfo.email)
    .replace(/\[TODAY'S DATE\]/gi, today)
    .replace(/\[TODAYS DATE\]/gi, today)
    .replace(/\[CURRENT DATE\]/gi, today);
}

/* ------------------------------------------------------------------ */
/*  Subscription generation handler                                   */
/* ------------------------------------------------------------------ */

async function handleSubscriptionGeneration(
  convex: ServiceConvex,
  caseId: string,
  caseRow: CaseRow,
  answers: Record<string, unknown>,
  userId: string,
  userInfo: UserInfo,
) {
  const diagnosticAnswers: DiagnosticAnswers = {
    wedge: 'subscription',
    jurisdiction: caseRow.jurisdiction,
    vertical: (answers['vertical'] ?? answers['service_vertical']) as DiagnosticAnswers['vertical'],
    company_name: answers['company_name'] as string | undefined,
    service_type: answers['service_type'] as string | undefined,
    account_identifier: answers['account_identifier'] as string | undefined,
    billing_email: answers['billing_email'] as string | undefined,
    monthly_charge: answers['monthly_charge'] as string | undefined,
    billing_frequency: answers['billing_frequency'] as string | undefined,
    last_charge_date: answers['last_charge_date'] as string | undefined,
    cancellation_effective_date: answers['cancellation_effective_date'] as string | undefined,
    prior_cancellation_attempt: answers['prior_cancellation_attempt'] as boolean | undefined,
    cancellation_date: answers['cancellation_date'] as string | undefined,
    cancellation_method: answers['cancellation_method'] as string | undefined,
    cancellation_result: answers['cancellation_result'] as string | undefined,
    wants_refund: answers['wants_refund'] as boolean | undefined,
    refund_amount: answers['refund_amount'] as string | undefined,
    refund_reason: answers['refund_reason'] as string | undefined,
    cancellation_barriers: answers['cancellation_barriers'] as string[] | undefined,
    additional_details: answers['additional_details'] as string | undefined,
    ...answers,
  };

  const correlationId = randomUUID();
  const result = await generateSequence(caseId, diagnosticAnswers);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, code: result.error.code },
      { status: 500 },
    );
  }

  const generatedSequence = result.sequence;

  // Replace [YOUR NAME], [YOUR EMAIL], [DATE] placeholders with real user data
  generatedSequence.steps = personalizeSequenceSteps(
    generatedSequence.steps,
    userInfo,
  );

  let sequenceRow: { id: string };
  try {
    sequenceRow = await convex.mutation(api.service.createSequence, {
      secret: serviceSecret(),
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to save generated sequence. Please try again.' },
      { status: 500 },
    );
  }

  await createAuditEntry(convex, {
    caseId,
    userId,
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

  await updateCaseStatus(convex, caseId);

  return NextResponse.json({ sequence_id: sequenceRow.id });
}

/* ------------------------------------------------------------------ */
/*  Deposit generation handler                                        */
/* ------------------------------------------------------------------ */

/**
 * Rel-H3: a PAID deposit case whose synchronous generation fails must never be
 * left as a bare 500 — the customer paid and got nothing. On the first failure
 * we hand the job to the background letter-generation queue (its own retries +
 * delivery email), and tell the user it's being prepared. The queued job is
 * idempotent (jobId `gen-${caseId}`, and the worker only generates a paid case
 * still in `intake`), so this is safe even if a later attempt also lands.
 *
 * Returns a NextResponse when it took over (enqueued or reported), or null when
 * the case is NOT a paid deposit (caller keeps its original error response).
 */
async function recoverPaidDepositFailure(
  caseId: string,
  caseRow: CaseRow,
  userId: string,
  reason: string,
): Promise<NextResponse | null> {
  if (caseRow.wedge !== 'deposit' || caseRow.payment_status !== 'paid') {
    return null;
  }

  // eslint-disable-next-line no-console
  console.error(`[generate] Paid deposit case ${caseId} failed synchronously: ${reason}`);
  Sentry.captureException(new Error(`Paid deposit generation failed: ${reason}`), {
    tags: { area: 'generate', caseId },
  });

  try {
    await enqueueLetterGeneration(caseId, userId, 'deposit', caseRow.jurisdiction);
    return NextResponse.json({
      queued: true,
      message:
        "We're preparing your letter. This is taking a little longer than usual — " +
        "we'll email you as soon as it's ready. Your payment is safe.",
    });
  } catch (enqueueErr) {
    // Redis unreachable — we can't retry in the background. Surface a clear,
    // non-500 message; the case stays paid+intake and support/ops can recover it.
    // eslint-disable-next-line no-console
    console.error(`[generate] Failed to enqueue recovery for paid case ${caseId}:`, enqueueErr);
    Sentry.captureException(enqueueErr, { tags: { area: 'generate-recovery', caseId } });
    return NextResponse.json(
      {
        error:
          "We hit a problem preparing your letter. Your payment is safe — please " +
          'try again in a few minutes, and contact support if it persists.',
        retry: true,
      },
      { status: 503, headers: { 'Retry-After': '30' } },
    );
  }
}

/**
 * Normalize diagnostic answers for the deposit letter generator.
 *
 * The diagnostic engine keys answers by NODE ID, and GROUP nodes store a nested
 * object of their sub-fields. So `landlord_name` lives at
 * `answers.landlord_info.landlord_name`, not `answers.landlord_name`, and the
 * deposit amount is under the node id `deposit_amount`, not the generator's
 * `original_deposit_amount`. Reading the flat keys directly produced letters
 * addressed to "[LANDLORD NAME]" demanding "$0" — a broken paid deliverable.
 *
 * This flattens the known group nodes to top-level field keys and maps the
 * renamed keys, WITHOUT clobbering any value already present at the target key
 * (e.g. from document extraction). Returns a new object; the original is left
 * intact and still spread last for anything not covered here.
 */
function normalizeDepositAnswers(
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...answers };

  // Flatten group-node answers ({ [nodeId]: { field: value } }) to top level.
  const groups = ['landlord_info', 'lease_dates', 'forwarding_address_details'];
  for (const g of groups) {
    const grp = answers[g];
    if (grp && typeof grp === 'object' && !Array.isArray(grp)) {
      for (const [k, val] of Object.entries(grp as Record<string, unknown>)) {
        if (out[k] === undefined) out[k] = val;
      }
    }
  }

  // Map renamed node-id keys to the generator's expected field names.
  const renames: Record<string, string> = {
    deposit_amount: 'original_deposit_amount',
    partial_amount_received: 'amount_returned',
  };
  for (const [from, to] of Object.entries(renames)) {
    if (out[to] === undefined && answers[from] !== undefined) {
      out[to] = answers[from];
    }
  }

  return out;
}

async function handleDepositGeneration(
  convex: ServiceConvex,
  caseId: string,
  caseRow: CaseRow,
  rawAnswers: Record<string, unknown>,
  userId: string,
) {
  // Payment and jurisdiction gates are enforced in the POST handler
  // before routing here. This function handles generation only.

  // Flatten group nodes + map renamed keys so the generator reads the real
  // landlord name / deposit amount instead of falling back to placeholders.
  const answers = normalizeDepositAnswers(rawAnswers);

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
    // Rel-H3: for a PAID deposit case, hand off to the background retry instead
    // of stranding the paying customer with a 500.
    const recovered = await recoverPaidDepositFailure(
      caseId,
      caseRow,
      userId,
      `generateLetter failed: ${result.error.code} ${result.error.message}`,
    );
    if (recovered) return recovered;
    return NextResponse.json(
      { error: result.error.message, code: result.error.code },
      { status: 500 },
    );
  }

  const generatedLetter = result.letter;

  let letterRow: { id: string };
  try {
    letterRow = await convex.mutation(api.service.createLetter, {
      secret: serviceSecret(),
      caseId: caseId as Id<'cases'>,
      content: generatedLetter.content,
      groundingContextIds: generatedLetter.grounding_context_ids,
      citationValidation: {
        valid: generatedLetter.citation_validation.valid,
        stripped: generatedLetter.citation_validation.stripped,
        pass: generatedLetter.citation_validation.pass,
      },
    });
  } catch (saveErr) {
    // Rel-H3: same recovery for a paid deposit whose letter save failed.
    const recovered = await recoverPaidDepositFailure(
      caseId,
      caseRow,
      userId,
      `createLetter failed: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
    );
    if (recovered) return recovered;
    return NextResponse.json(
      { error: 'Failed to save generated letter. Please try again.' },
      { status: 500 },
    );
  }

  await createAuditEntry(convex, {
    caseId,
    userId,
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

  await updateCaseStatus(convex, caseId);

  /* ---- Schedule deadline events (best-effort) ---- */
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
    // Non-critical — log but don't fail generation
    // eslint-disable-next-line no-console
    console.error('Failed to schedule deadlines:', deadlineErr);
  }

  /* ---- Queue letter delivery email (best-effort) ---- */
  try {
    const userEmail = await convex.query(api.service.userEmailById, {
      secret: serviceSecret(),
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
    // Non-critical — log but don't fail generation
    // eslint-disable-next-line no-console
    console.error('Failed to enqueue letter delivery email:', emailErr);
  }

  return NextResponse.json({ letter_id: letterRow.id });
}

/* ------------------------------------------------------------------ */
/*  POST                                                              */
/* ------------------------------------------------------------------ */

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    /* ---- Auth ---- */
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    /* ---- Rate limit ---- */
    const rateResult = await checkRateLimit('generation', user.id);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before generating again.' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    /* ---- Load case (ownership enforced by cases.getMine) ---- */
    const caseRow = (await q(api.cases.getMine, { caseId: caseId as Id<'cases'> })) as CaseRow | null;
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const convex = createServiceConvexClient();

    /* ---- Validate case state ---- */
    if (caseRow.status !== 'intake') {
      return NextResponse.json(
        { error: `Cannot generate: case status is '${caseRow.status}', expected 'intake'.` },
        { status: 409 },
      );
    }

    /* ---- Validate diagnostic completion ---- */
    const diagnosticState = caseRow.diagnostic_state as DiagnosticState | null;

    if (!diagnosticState || !diagnosticState.is_completed) {
      return NextResponse.json(
        { error: 'Diagnostic is not complete. Finish all diagnostic steps before generating.' },
        { status: 400 },
      );
    }

    const answers = decryptAnswersPii(diagnosticState.answers as Record<string, unknown>);

    /* ---- Final refusal check ---- */
    const refusalResult = checkRefusal(answers, caseRow.wedge as 'deposit' | 'subscription');

    if (refusalResult.triggered && refusalResult.severity === 'hard_block') {
      // A6: close the case server-side ATOMICALLY here, rather than relying on
      // the client to make a second /refusal call. A hard-blocked case must not
      // be left open.
      const trigger = refusalResult.rule?.rule_id ?? 'hard_block';
      try {
        await m(api.caseStatus.setRefusalMine, {
          caseId: caseId as Id<'cases'>,
          refusalTrigger: trigger,
        });
      } catch (closeErr) {
        // eslint-disable-next-line no-console
        console.error('[generate] Failed to close refused case:', closeErr);
      }

      // If the case was already PAID (e.g. answers edited post-payment to add an
      // active-litigation trigger), the charge must not be stranded. Attempt an
      // auto-refund and tell the user, rather than closing silently with money held.
      const wasPaid = caseRow.payment_status === 'paid';
      let refundInitiated = false;
      if (wasPaid && caseRow.polar_order_id) {
        try {
          const refund = await processAutoRefundIfNeeded(caseId, caseRow.polar_order_id);
          refundInitiated = refund.refunded;
        } catch (refundErr) {
          // eslint-disable-next-line no-console
          console.error('[generate] paid+refused case: refund attempt failed:', refundErr);
        }
        if (!refundInitiated) {
          // eslint-disable-next-line no-console
          console.error(
            `[generate] PAID case ${caseId} hard-blocked (${trigger}) but refund not ` +
              `confirmed — needs manual review so the customer isn't charged for nothing.`,
          );
        }
      }

      return NextResponse.json(
        {
          error: wasPaid
            ? 'This case cannot proceed. If you were charged, a refund has been initiated.'
            : 'This case cannot proceed with generation.',
          refusal_trigger: trigger,
          decline_reason: refusalResult.rule?.decline_reason,
          refund_initiated: refundInitiated,
        },
        { status: 422 },
      );
    }

    /* ---- Validate wedge ---- */
    const wedge = caseRow.wedge as 'deposit' | 'subscription';
    if (wedge !== 'deposit' && wedge !== 'subscription') {
      return NextResponse.json(
        { error: `Unsupported wedge: ${caseRow.wedge}` },
        { status: 400 },
      );
    }

    /* ---- Deposit-specific gates (must run before enqueue) ---- */
    if (wedge === 'deposit') {
      // A case is payable either by a per-case Polar payment OR by an active
      // subscription (the "Unlimited" plan waives the per-case $49). Without the
      // subscription branch, a paying Unlimited subscriber would still be charged
      // per case. `currentMine` is scoped to the requesting user and returns a
      // subscription only when status is 'active'/'past_due'.
      const activeSubscription = await q(api.subscriptions.currentMine, {});
      const isPaid = caseRow.payment_status === 'paid';
      if (!isPaid && !activeSubscription) {
        return NextResponse.json(
          { error: 'Payment required before letter generation.' },
          { status: 402 },
        );
      }

      const isSupported = DEPOSIT_JURISDICTION.includes(
        caseRow.jurisdiction as DepositJurisdiction,
      );
      if (!isSupported) {
        try {
          const orderId = (caseRow as unknown as { polar_order_id?: string | null })
            .polar_order_id;
          if (orderId) {
            await processAutoRefundIfNeeded(caseId, orderId);
          }
        } catch (refundErr) {
          // eslint-disable-next-line no-console
          console.error('Auto-refund attempt failed:', refundErr);
        }

        return NextResponse.json(
          {
            error: `Jurisdiction '${caseRow.jurisdiction}' is not supported for deposit cases. Supported: ${DEPOSIT_JURISDICTION.join(', ')}. If you were charged, a refund has been initiated.`,
          },
          { status: 422 },
        );
      }
    }

    /* ---- Circuit breaker: check generation queue depth ---- */
    // R-4: fail SAFE, not open. If we can't read the queue depth, Redis is
    // unreachable — which also means we can't enqueue to shed load. Running
    // synchronously in that state invites resource exhaustion during exactly
    // the spike the breaker exists to survive. Return 503 and let the client
    // retry, rather than bypassing load-shedding.
    let queueDepth = 0;
    try {
      queueDepth = await getGenerationQueueDepth();
    } catch {
      return NextResponse.json(
        {
          error:
            'We are experiencing high demand right now. Please try again in a moment — ' +
            'your progress is saved.',
          retry: true,
        },
        { status: 503, headers: { 'Retry-After': '15' } },
      );
    }

    if (queueDepth >= CIRCUIT_BREAKER_THRESHOLD) {
      // Queue is deep — enqueue and tell user to check email
      const jobId = await enqueueLetterGeneration(
        caseId,
        user.id,
        wedge,
        caseRow.jurisdiction,
      );

      return NextResponse.json({
        queued: true,
        job_id: jobId,
        queue_depth: queueDepth,
        message:
          'We are experiencing high demand. Your letter is being generated ' +
          'and will be emailed to you when ready. You can also check back on ' +
          'this page in a few minutes.',
      });
    }

    /* ---- Extract user identity for personalization ---- */
    const userInfo: UserInfo = {
      fullName: user.name ?? user.email?.split('@')[0] ?? '',
      email: user.email ?? '',
    };

    /* ---- Normal path: generate synchronously ---- */
    if (wedge === 'subscription') {
      return await handleSubscriptionGeneration(convex, caseId, caseRow, answers, user.id, userInfo);
    }

    return await handleDepositGeneration(convex, caseId, caseRow, answers, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/generate error:', message);
    Sentry.captureException(err, { tags: { area: 'generate' } });
    // Generic body — never echo internal error detail to the client (Rel-H4).
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
