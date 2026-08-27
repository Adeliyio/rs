/**
 * Subscription sequence generation orchestrator — server-only.
 *
 * Coordinates the full pipeline: KB loading, grounding context assembly,
 * LLM generation, citation validation, compliance scanning, and
 * disclaimer injection. Returns a fully validated GeneratedSequence
 * ready for persistence.
 *
 * Does NOT save to DB — the API route handles persistence.
 * Does NOT check refusal — the API route checks before calling this.
 */

import { assembleGroundingContext } from '@/lib/ai/grounding';
import type { UserSituation } from '@/lib/ai/generation';
import { generateSubscriptionSequenceFromTemplates } from '@/features/subscription/generation/template-engine';
import { validateCitations } from '@/lib/ai/citation-validator';
import { scanCompliance } from '@/lib/ai/compliance-scanner';
import { injectEmailDisclaimer } from '@/lib/ai/disclaimer-injector';
import { loadKbEntry } from '@/lib/kb/loader';
import type {
  GeneratedSequence,
  SequenceStep,
  CitationValidationResult,
  Citation,
} from '@/types/generation.types';
import type { Statute } from '@/types/kb.types';
import type { Wedge, Vertical } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DiagnosticAnswers {
  wedge: Wedge;
  jurisdiction: string;
  vertical?: Vertical;
  company_name?: string;
  service_type?: string;
  account_identifier?: string;
  billing_email?: string;
  monthly_charge?: string;
  billing_frequency?: string;
  last_charge_date?: string;
  cancellation_effective_date?: string;
  prior_cancellation_attempt?: boolean;
  cancellation_date?: string;
  cancellation_method?: string;
  cancellation_result?: string;
  wants_refund?: boolean;
  refund_amount?: string;
  refund_reason?: string;
  cancellation_barriers?: string[];
  additional_details?: string;
  [key: string]: unknown;
}

export interface SequenceGenerationError {
  code: 'GENERATION_FAILED' | 'VALIDATION_FAILED' | 'COMPLIANCE_FAILED';
  message: string;
}

export type SequenceGenerationResult =
  | { ok: true; sequence: GeneratedSequence }
  | { ok: false; error: SequenceGenerationError };

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function extractUserSituation(answers: DiagnosticAnswers): UserSituation {
  // Also check service_vertical as the diagnostic graph node key
  const vertical = answers.vertical ?? answers['service_vertical'] as string | undefined;

  return {
    company_name: answers.company_name ?? '[Company Name]',
    service_type: answers.service_type ?? vertical ?? 'subscription service',
    account_identifier: answers.account_identifier ?? (answers['account_identifier'] as string | undefined),
    billing_email: answers.billing_email ?? (answers['billing_email'] as string | undefined),
    monthly_charge: answers.monthly_charge ?? (answers['monthly_charge'] as string | undefined),
    billing_frequency: answers.billing_frequency ?? (answers['billing_frequency'] as string | undefined),
    last_charge_date: answers.last_charge_date ?? (answers['last_charge_date'] as string | undefined),
    cancellation_effective_date: answers.cancellation_effective_date ?? (answers['cancellation_effective_date'] as string | undefined),
    previous_cancellation_date: answers.prior_cancellation_attempt ? (answers.cancellation_date ?? answers['cancellation_date'] as string | undefined) : undefined,
    previous_cancellation_method: answers.prior_cancellation_attempt ? (answers.cancellation_method ?? answers['cancellation_method'] as string | undefined) : undefined,
    previous_cancellation_result: answers.prior_cancellation_attempt ? (answers.cancellation_result ?? answers['cancellation_result'] as string | undefined) : undefined,
    wants_refund: answers.wants_refund ?? (answers['wants_refund'] as boolean | undefined),
    refund_amount: answers.refund_amount ?? (answers['refund_amount'] as string | undefined),
    refund_reason: answers.refund_reason ?? (answers['refund_reason'] as string | undefined),
    cancellation_barriers: answers.cancellation_barriers ?? [],
    additional_details: answers.additional_details,
  };
}

/** Collect all Statute objects from loaded KB entries */
function collectStatutes(
  wedge: string,
  jurisdiction: string,
): Statute[] {
  const statutes: Statute[] = [];

  // Federal
  try {
    const federal = loadKbEntry(wedge, 'federal');
    statutes.push(...federal.statutes);
  } catch {
    // Federal KB may not exist for all wedges
  }

  // State-specific
  const normalizedJurisdiction = jurisdiction.toUpperCase();
  if (normalizedJurisdiction !== 'FEDERAL') {
    try {
      const state = loadKbEntry(wedge, normalizedJurisdiction);
      statutes.push(...state.statutes);
    } catch {
      // State KB may not exist
    }
  }

  return statutes;
}

/** Merge citation validation results from multiple steps */
function mergeCitationResults(
  results: CitationValidationResult[],
): CitationValidationResult {
  const allValid: Citation[] = [];
  const allStripped: Citation[] = [];

  for (const r of results) {
    allValid.push(...r.valid);
    allStripped.push(...r.stripped);
  }

  return {
    valid: allValid,
    stripped: allStripped,
    pass: allStripped.length <= 2 && allValid.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                          */
/* ------------------------------------------------------------------ */

async function runPipeline(
  answers: DiagnosticAnswers,
  _caseId: string,
  strict: boolean,
): Promise<{
  steps: SequenceStep[];
  citationResult: CitationValidationResult;
  compliancePass: boolean;
  groundingContextIds: string[];
}> {
  const { wedge, jurisdiction, vertical } = answers;

  /* 1. Assemble grounding context */
  const grounding = assembleGroundingContext(
    wedge,
    jurisdiction,
    vertical,
    answers,
  );

  /* 2. Build user situation */
  const userSituation = extractUserSituation(answers);

  /* 3. Generate sequence via deterministic templates ($0, synchronous, no LLM) */
  const rawSteps = generateSubscriptionSequenceFromTemplates(
    grounding.context,
    grounding.statute_ids,
    userSituation,
    vertical,
    strict,
  );

  /* 4. Collect KB statutes for citation validation */
  const kbStatutes = collectStatutes(wedge, jurisdiction);

  /* 5. Validate citations + scan compliance for each step */
  const citationResults: CitationValidationResult[] = [];
  let allCompliancePass = true;
  const processedSteps: SequenceStep[] = [];

  for (const step of rawSteps) {
    // Citation validation
    const { result: citResult, cleanedText } = validateCitations(
      step.body,
      grounding.statute_ids,
      kbStatutes,
    );
    citationResults.push(citResult);

    // Compliance scan on cleaned text
    const compResult = scanCompliance(cleanedText);
    if (!compResult.pass) {
      allCompliancePass = false;
    }

    // Inject disclaimer
    const bodyWithDisclaimer = injectEmailDisclaimer(cleanedText);

    processedSteps.push({
      ...step,
      body: bodyWithDisclaimer,
      citations: citResult.valid,
    });
  }

  const mergedCitations = mergeCitationResults(citationResults);

  return {
    steps: processedSteps,
    citationResult: mergedCitations,
    compliancePass: allCompliancePass,
    groundingContextIds: grounding.kb_entry_ids,
  };
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates a complete, validated subscription email sequence.
 *
 * Steps:
 * 1. Extract wedge, jurisdiction, vertical from answers
 * 2. Load KB entries and assemble grounding context
 * 3. Generate the sequence via deterministic templates ($0, no LLM)
 * 4. Validate citations on each step
 * 5. Scan compliance on each step
 * 6. Inject disclaimers
 * 7. If validation/compliance fails: retry once (templates always pass, so harmless)
 * 8. Return GeneratedSequence or error
 *
 * @param caseId  The case ID (for the returned sequence).
 * @param diagnosticAnswers  Answers from the diagnostic flow.
 */
export async function generateSequence(
  caseId: string,
  diagnosticAnswers: DiagnosticAnswers,
): Promise<SequenceGenerationResult> {
  const { jurisdiction, vertical } = diagnosticAnswers;

  try {
    /* ---- First attempt ---- */
    const firstAttempt = await runPipeline(diagnosticAnswers, caseId, false);

    const citationPass = firstAttempt.citationResult.pass;
    const compliancePass = firstAttempt.compliancePass;

    if (citationPass && compliancePass) {
      return {
        ok: true,
        sequence: buildSequence(
          caseId,
          jurisdiction,
          vertical,
          firstAttempt,
        ),
      };
    }

    /* ---- Retry with strict prompt ---- */
    const secondAttempt = await runPipeline(diagnosticAnswers, caseId, true);

    const retryPass =
      secondAttempt.citationResult.pass && secondAttempt.compliancePass;

    if (retryPass) {
      return {
        ok: true,
        sequence: buildSequence(
          caseId,
          jurisdiction,
          vertical,
          secondAttempt,
        ),
      };
    }

    /* ---- Both attempts failed ---- */
    const failureReasons: string[] = [];
    if (!secondAttempt.citationResult.pass) {
      const strippedCount = secondAttempt.citationResult.stripped.length;
      const validCount = secondAttempt.citationResult.valid.length;
      failureReasons.push(
        `Citation validation failed: ${strippedCount} ungrounded citation(s) stripped, ${validCount} valid citation(s) remaining.`,
      );
    }
    if (!secondAttempt.compliancePass) {
      failureReasons.push(
        'Compliance scan detected prohibited phrases after strict retry.',
      );
    }

    return {
      ok: false,
      error: {
        code: !secondAttempt.citationResult.pass
          ? 'VALIDATION_FAILED'
          : 'COMPLIANCE_FAILED',
        message: `Generation failed validation after retry. ${failureReasons.join(' ')}`,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: {
        code: 'GENERATION_FAILED',
        message: `Generation pipeline error: ${message}`,
      },
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Build the final sequence object                                   */
/* ------------------------------------------------------------------ */

function buildSequence(
  caseId: string,
  jurisdiction: string,
  vertical: string | undefined,
  pipeline: {
    steps: SequenceStep[];
    citationResult: CitationValidationResult;
    compliancePass: boolean;
    groundingContextIds: string[];
  },
): GeneratedSequence {
  return {
    case_id: caseId,
    vertical: vertical ?? 'general',
    jurisdiction,
    steps: pipeline.steps,
    grounding_context_ids: pipeline.groundingContextIds,
    citation_validation: pipeline.citationResult,
    compliance_scan_pass: pipeline.compliancePass,
    created_at: new Date().toISOString(),
  };
}
