/**
 * AI output validator — server-only.
 *
 * Defense-in-depth validation for AI-generated content (SEC-01).
 * Runs AFTER generation to catch outputs that evaded input sanitization.
 *
 * Checks:
 * 1. All cited statute_ids exist in the provided grounding context
 * 2. Output does not contain system prompt leakage patterns
 * 3. Output does not contain prohibited phrases (evaluative language)
 * 4. Output length is within expected bounds
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface OutputValidationResult {
  /** Whether the output passed all checks. */
  pass: boolean;
  /** List of issues found. */
  issues: OutputIssue[];
}

export interface OutputIssue {
  /** Category of the issue. */
  type: 'ungrounded_citation' | 'prompt_leakage' | 'prohibited_phrase' | 'length_violation';
  /** Human-readable description. */
  message: string;
  /** Severity: 'error' blocks output, 'warning' is logged but allowed. */
  severity: 'error' | 'warning';
}

/* ------------------------------------------------------------------ */
/*  Patterns                                                          */
/* ------------------------------------------------------------------ */

/**
 * Patterns that indicate the system prompt leaked into the output.
 * If the AI repeats these, prompt injection may have succeeded.
 */
const PROMPT_LEAKAGE_PATTERNS: RegExp[] = [
  /CRITICAL RULES/i,
  /GROUNDING CONTEXT/i,
  /PROMPT_INJECTION_GUARD/i,
  /<user_data>/i,
  /<\/user_data>/i,
  /SECURITY.*PROMPT INJECTION DEFENSE/i,
  /UNTRUSTED USER INPUT/i,
  /STRICT MODE.*ADDITIONAL CONSTRAINTS/i,
];

/**
 * Prohibited phrases in generated output that indicate the AI is
 * providing legal advice or evaluating the user's case.
 */
const PROHIBITED_OUTPUT_PHRASES: string[] = [
  'legal advice',
  'strong case',
  'weak case',
  'likely to win',
  'guaranteed',
  'will recover',
  'robot lawyer',
  'AI lawyer',
  'legal representation',
  'on your behalf',
  'your attorney',
  'legal counsel',
];

/** Maximum expected output length in characters. */
const MAX_OUTPUT_LENGTH = 50_000;

/** Minimum expected output length for a letter. */
const MIN_OUTPUT_LENGTH = 200;

/* ------------------------------------------------------------------ */
/*  Core validation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validates AI-generated output for security and compliance issues.
 *
 * @param output        The generated text content.
 * @param citedIds      Statute IDs the AI claims to have cited.
 * @param groundingIds  Statute IDs that were actually in the grounding context.
 */
export function validateOutput(
  output: string,
  citedIds: string[],
  groundingIds: string[],
): OutputValidationResult {
  const issues: OutputIssue[] = [];
  const groundingSet = new Set(groundingIds);

  // 1. Check cited statute_ids exist in grounding context
  for (const id of citedIds) {
    if (!groundingSet.has(id)) {
      issues.push({
        type: 'ungrounded_citation',
        message: `Cited statute "${id}" is not in the grounding context`,
        severity: 'error',
      });
    }
  }

  // 2. Check for system prompt leakage
  for (const pattern of PROMPT_LEAKAGE_PATTERNS) {
    if (pattern.test(output)) {
      issues.push({
        type: 'prompt_leakage',
        message: `Output contains system prompt fragment matching: ${pattern.source}`,
        severity: 'error',
      });
    }
  }

  // 3. Check for prohibited phrases
  const lowerOutput = output.toLowerCase();
  for (const phrase of PROHIBITED_OUTPUT_PHRASES) {
    if (lowerOutput.includes(phrase)) {
      issues.push({
        type: 'prohibited_phrase',
        message: `Output contains prohibited phrase: "${phrase}"`,
        severity: 'warning',
      });
    }
  }

  // 4. Check output length bounds
  if (output.length > MAX_OUTPUT_LENGTH) {
    issues.push({
      type: 'length_violation',
      message: `Output exceeds max length: ${output.length} > ${MAX_OUTPUT_LENGTH}`,
      severity: 'error',
    });
  }
  if (output.length < MIN_OUTPUT_LENGTH) {
    issues.push({
      type: 'length_violation',
      message: `Output below min length: ${output.length} < ${MIN_OUTPUT_LENGTH}`,
      severity: 'warning',
    });
  }

  // Pass = no errors (warnings are allowed)
  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    pass: !hasErrors,
    issues,
  };
}

/**
 * Logs output validation failures for security monitoring.
 */
export function logValidationResult(
  result: OutputValidationResult,
  context: { wedge: string; caseId?: string },
): void {
  if (result.pass && result.issues.length === 0) return;

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[OUTPUT VALIDATION FAILED] wedge=${context.wedge} caseId=${context.caseId ?? 'unknown'} ` +
        `errors=${errors.length} warnings=${warnings.length} ` +
        `details=${JSON.stringify(errors.map((e) => e.message))}`,
    );
  } else if (warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[OUTPUT VALIDATION WARNING] wedge=${context.wedge} caseId=${context.caseId ?? 'unknown'} ` +
        `warnings=${warnings.length} ` +
        `details=${JSON.stringify(warnings.map((w) => w.message))}`,
    );
  }
}
