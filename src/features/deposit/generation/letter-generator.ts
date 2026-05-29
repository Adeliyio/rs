/**
 * Deposit letter generation orchestrator — server-only.
 *
 * Coordinates the full pipeline: KB loading, grounding context assembly,
 * LLM generation, citation validation, compliance scanning, and
 * disclaimer injection. Returns a fully validated GeneratedLetter
 * ready for persistence.
 *
 * Does NOT save to DB — the API route handles persistence.
 * Does NOT check refusal — the API route checks before calling this.
 */

import { assembleGroundingContext } from '@/lib/ai/grounding';
import {
  generateDepositLetter,
  type TenantSituation,
  type Deduction,
  type ItemizationStatus,
} from '@/lib/ai/deposit-generation';
import { validateCitations } from '@/lib/ai/citation-validator';
import { scanCompliance } from '@/lib/ai/compliance-scanner';
import { injectLetterDisclaimer } from '@/lib/ai/disclaimer-injector';
import { loadKbEntry } from '@/lib/kb/loader';
import type {
  GeneratedLetter,
  CitationValidationResult,
  Citation,
} from '@/types/generation.types';
import type { Statute } from '@/types/kb.types';
import type { Wedge } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DepositDiagnosticAnswers {
  wedge: Wedge;
  jurisdiction: string;
  tenant_name?: string;
  property_address?: string;
  landlord_name?: string;
  landlord_address?: string;
  move_out_date?: string;
  lease_start_date?: string;
  lease_end_date?: string;
  original_deposit_amount?: number;
  amount_returned?: number;
  amount_withheld?: number;
  demand_amount?: number;
  days_since_move_out?: number;
  itemization_received?: boolean;
  itemization_status?: ItemizationStatus;
  forwarding_address_provided?: boolean;
  forwarding_address_date?: string;
  walkthrough_completed?: boolean;
  deductions?: Deduction[];
  additional_context?: string;
  [key: string]: unknown;
}

export interface LetterGenerationError {
  code: 'GENERATION_FAILED' | 'VALIDATION_FAILED' | 'COMPLIANCE_FAILED';
  message: string;
}

export type LetterGenerationResult =
  | { ok: true; letter: GeneratedLetter }
  | { ok: false; error: LetterGenerationError };

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function extractTenantSituation(
  answers: DepositDiagnosticAnswers,
): TenantSituation {
  return {
    tenant_name: answers.tenant_name ?? '[YOUR NAME]',
    property_address: answers.property_address ?? '[PROPERTY ADDRESS]',
    landlord_name: answers.landlord_name ?? '[LANDLORD NAME]',
    landlord_address: answers.landlord_address,
    move_out_date: answers.move_out_date ?? '[MOVE-OUT DATE]',
    lease_start_date: answers.lease_start_date,
    lease_end_date: answers.lease_end_date,
    original_deposit_amount: answers.original_deposit_amount ?? 0,
    amount_returned: answers.amount_returned,
    amount_withheld: answers.amount_withheld ?? 0,
    demand_amount: answers.demand_amount ?? answers.amount_withheld ?? 0,
    deductions: answers.deductions ?? [],
    days_since_move_out: answers.days_since_move_out ?? 0,
    itemization_received: answers.itemization_received ?? false,
    itemization_status: answers.itemization_status ?? 'nothing',
    forwarding_address_provided: answers.forwarding_address_provided ?? false,
    forwarding_address_date: answers.forwarding_address_date,
    walkthrough_completed: answers.walkthrough_completed,
    additional_context: answers.additional_context,
  };
}

function collectStatutes(wedge: string, jurisdiction: string): Statute[] {
  const statutes: Statute[] = [];

  const normalizedJurisdiction = jurisdiction.toUpperCase();
  try {
    const stateKb = loadKbEntry(wedge, normalizedJurisdiction);
    statutes.push(...stateKb.statutes);
  } catch {
    // State KB may not exist
  }

  return statutes;
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                          */
/* ------------------------------------------------------------------ */

async function runPipeline(
  answers: DepositDiagnosticAnswers,
  _caseId: string,
  strict: boolean,
): Promise<{
  content: string;
  rebuttalTable: string | undefined;
  citationResult: CitationValidationResult;
  compliancePass: boolean;
  groundingContextIds: string[];
}> {
  const { wedge, jurisdiction } = answers;

  /* 1. Assemble grounding context */
  const grounding = assembleGroundingContext(
    wedge,
    jurisdiction,
    undefined,
    answers,
  );

  /* 2. Build tenant situation */
  const tenantSituation = extractTenantSituation(answers);

  /* 3. Generate letter via LLM */
  const raw = await generateDepositLetter(
    grounding.context,
    grounding.statute_ids,
    tenantSituation,
    strict,
  );

  /* 4. Collect KB statutes for citation validation */
  const kbStatutes = collectStatutes(wedge, jurisdiction);

  /* 5. Validate citations in the letter body */
  const { result: citResult, cleanedText } = validateCitations(
    raw.content,
    grounding.statute_ids,
    kbStatutes,
  );

  /* 6. Compliance scan on cleaned text */
  const compResult = scanCompliance(cleanedText);

  /* 7. Inject disclaimer */
  const contentWithDisclaimer = injectLetterDisclaimer(cleanedText);

  return {
    content: contentWithDisclaimer,
    rebuttalTable: raw.rebuttal_table,
    citationResult: citResult,
    compliancePass: compResult.pass,
    groundingContextIds: grounding.kb_entry_ids,
  };
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates a complete, validated deposit demand letter.
 *
 * Steps:
 * 1. Extract jurisdiction from answers
 * 2. Load KB entries and assemble grounding context
 * 3. Call generateDepositLetter() via LLM
 * 4. Validate citations
 * 5. Scan compliance
 * 6. Inject disclaimers
 * 7. If validation/compliance fails: retry once with stricter prompt
 * 8. Return GeneratedLetter or error
 */
export async function generateLetter(
  caseId: string,
  diagnosticAnswers: DepositDiagnosticAnswers,
): Promise<LetterGenerationResult> {
  const { jurisdiction } = diagnosticAnswers;

  try {
    /* ---- First attempt ---- */
    const firstAttempt = await runPipeline(diagnosticAnswers, caseId, false);

    if (firstAttempt.citationResult.pass && firstAttempt.compliancePass) {
      return {
        ok: true,
        letter: buildLetter(caseId, jurisdiction, firstAttempt),
      };
    }

    /* ---- Retry with strict prompt ---- */
    const secondAttempt = await runPipeline(diagnosticAnswers, caseId, true);

    if (secondAttempt.citationResult.pass && secondAttempt.compliancePass) {
      return {
        ok: true,
        letter: buildLetter(caseId, jurisdiction, secondAttempt),
      };
    }

    /* ---- Both attempts failed ---- */
    const failureReasons: string[] = [];
    if (!secondAttempt.citationResult.pass) {
      failureReasons.push(
        `Citation validation failed: ${secondAttempt.citationResult.stripped.length} ungrounded citation(s) stripped, ${secondAttempt.citationResult.valid.length} valid citation(s) remaining.`,
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
/*  Build the final letter object                                     */
/* ------------------------------------------------------------------ */

function buildLetter(
  caseId: string,
  jurisdiction: string,
  pipeline: {
    content: string;
    rebuttalTable: string | undefined;
    citationResult: CitationValidationResult;
    compliancePass: boolean;
    groundingContextIds: string[];
  },
): GeneratedLetter {
  const allCitations: Citation[] = pipeline.citationResult.valid;

  return {
    case_id: caseId,
    jurisdiction,
    content: pipeline.content,
    rebuttal_table: pipeline.rebuttalTable,
    citations: allCitations,
    grounding_context_ids: pipeline.groundingContextIds,
    citation_validation: pipeline.citationResult,
    compliance_scan_pass: pipeline.compliancePass,
    created_at: new Date().toISOString(),
  };
}
