/**
 * KB validation utilities.
 *
 * Re-exports Zod schemas from kb.types and adds cross-reference
 * and graph-structural validation functions that can be imported
 * anywhere (unlike scripts/validate-kb.ts which is CLI-only).
 */

import type { ZodError } from 'zod';

// Re-export all Zod schemas for convenience
export {
  statuteSchema,
  keyProvisionSchema,
  deadlineRuleSchema,
  deadlinePromptConfigSchema,
  penaltySchema,
  escalationVenueSchema,
  deductionCategorySchema,
  specialProvisionSchema,
  verificationSchema,
  kbEntrySchema,
  packetTemplateSchema,
  packetFeesSchema,
  packetMediationSchema,
  verticalTemplateSchema,
  emailStepTemplateSchema,
  stateHealthClubLawSchema,
  refusalRuleSchema,
  refusalResourceTemplateSchema,
  tangledCaseRulesSchema,
  declineCopyMessageSchema,
  declineCopySchema,
  adversarialCounselTriggerSchema,
  subscriptionBaseSchema,
  disclaimerSchema,
  disclaimersFileSchema,
} from '@/types/kb.types';

import {
  kbEntrySchema,
} from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Validation result type                                            */
/* ------------------------------------------------------------------ */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

function fromZodError(err: ZodError): ValidationResult {
  const errors = err.issues.map(
    (i) => `${i.path.join('.')}: ${i.message}`,
  );
  return { valid: false, errors, warnings: [] };
}

/* ------------------------------------------------------------------ */
/*  KB Entry validation                                               */
/* ------------------------------------------------------------------ */

/** Validate a KB entry against the Zod schema. */
export function validateKbEntry(entry: unknown): ValidationResult {
  const result = kbEntrySchema.safeParse(entry);
  if (!result.success) {
    return fromZodError(result.error);
  }
  return ok();
}
