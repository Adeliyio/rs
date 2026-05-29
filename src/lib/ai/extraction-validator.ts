/**
 * Extraction result validator — server-only.
 *
 * Validates fields extracted by GPT-4o Vision against expected
 * schemas and value ranges. Catches document-based prompt injection
 * attempts that produce obviously wrong values. (SEC-08)
 *
 * Checks:
 * 1. Extracted field types match schema expectations
 * 2. Numeric values fall within reasonable ranges
 * 3. Date values are parseable and not in the far future
 * 4. Confidence scores are between 0 and 1
 * 5. String fields don't contain suspicious injection patterns
 */

import type { ExtractionFieldConfidence } from '@/types/external/openai.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ExtractionValidationResult {
  /** Whether all high-confidence fields passed validation. */
  pass: boolean;
  /** List of field-level issues found. */
  issues: ExtractionIssue[];
}

export interface ExtractionIssue {
  field: string;
  type: 'type_mismatch' | 'range_violation' | 'date_invalid' | 'confidence_invalid' | 'suspicious_content';
  message: string;
  severity: 'error' | 'warning';
}

/* ------------------------------------------------------------------ */
/*  Validation rules                                                  */
/* ------------------------------------------------------------------ */

/** Reasonable range for monetary values in USD. */
const MIN_AMOUNT = 0;
const MAX_AMOUNT = 1_000_000;

/** Suspicious patterns in extracted text (potential injection). */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now/i,
  /system\s*:/i,
  /\bprompt\b.*\binjection\b/i,
  /<\/?(?:script|system|user_data)>/i,
];

/* ------------------------------------------------------------------ */
/*  Core validation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validates extraction results against expected types and ranges.
 *
 * @param fields       The extracted fields from GPT-4o Vision.
 * @param schemaName   The schema used for extraction (e.g. 'lease_agreement').
 */
export function validateExtractionResult(
  fields: Record<string, ExtractionFieldConfidence>,
  schemaName: string,
): ExtractionValidationResult {
  const issues: ExtractionIssue[] = [];

  for (const [fieldName, field] of Object.entries(fields)) {
    // Skip null/empty values
    if (field.value === null || field.value === undefined) continue;

    // 1. Confidence check
    if (typeof field.confidence !== 'number' || field.confidence < 0 || field.confidence > 1) {
      issues.push({
        field: fieldName,
        type: 'confidence_invalid',
        message: `Confidence ${field.confidence} is not between 0 and 1`,
        severity: 'error',
      });
    }

    // 2. Numeric range checks
    if (isMonetaryField(fieldName, schemaName) && typeof field.value === 'number') {
      if (field.value < MIN_AMOUNT || field.value > MAX_AMOUNT) {
        issues.push({
          field: fieldName,
          type: 'range_violation',
          message: `Monetary value ${field.value} outside range [${MIN_AMOUNT}, ${MAX_AMOUNT}]`,
          severity: field.confidence > 0.5 ? 'error' : 'warning',
        });
      }
    }

    // 3. Date validation
    if (isDateField(fieldName) && typeof field.value === 'string') {
      const date = new Date(field.value);
      if (isNaN(date.getTime())) {
        issues.push({
          field: fieldName,
          type: 'date_invalid',
          message: `Date value "${field.value}" is not parseable`,
          severity: 'warning',
        });
      } else {
        const fiveYearsFromNow = new Date();
        fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
        if (date > fiveYearsFromNow) {
          issues.push({
            field: fieldName,
            type: 'date_invalid',
            message: `Date value "${field.value}" is more than 5 years in the future`,
            severity: 'warning',
          });
        }
      }
    }

    // 4. String suspicious content check
    if (typeof field.value === 'string') {
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(field.value)) {
          issues.push({
            field: fieldName,
            type: 'suspicious_content',
            message: `Field "${fieldName}" contains suspicious pattern: ${pattern.source}`,
            severity: 'warning',
          });
          break; // One warning per field is enough
        }
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { pass: !hasErrors, issues };
}

/* ------------------------------------------------------------------ */
/*  Field classification helpers                                      */
/* ------------------------------------------------------------------ */

/** Fields that represent monetary amounts. */
function isMonetaryField(fieldName: string, _schemaName: string): boolean {
  const monetaryPatterns = [
    'amount', 'deposit', 'rent', 'charge', 'withheld', 'total',
  ];
  const lower = fieldName.toLowerCase();
  return monetaryPatterns.some((p) => lower.includes(p));
}

/** Fields that represent dates. */
function isDateField(fieldName: string): boolean {
  const datePatterns = ['date', 'start', 'end', 'termination'];
  const lower = fieldName.toLowerCase();
  return datePatterns.some((p) => lower.includes(p));
}

/**
 * Logs extraction validation issues for security monitoring.
 */
export function logExtractionValidation(
  result: ExtractionValidationResult,
  context: { schemaName: string; documentId?: string },
): void {
  if (result.pass && result.issues.length === 0) return;

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[EXTRACTION VALIDATION FAILED] schema=${context.schemaName} ` +
        `docId=${context.documentId ?? 'unknown'} errors=${errors.length} ` +
        `details=${JSON.stringify(errors.map((e) => `${e.field}: ${e.message}`))}`,
    );
  } else if (warnings.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[EXTRACTION VALIDATION WARNING] schema=${context.schemaName} ` +
        `docId=${context.documentId ?? 'unknown'} warnings=${warnings.length}`,
    );
  }
}
