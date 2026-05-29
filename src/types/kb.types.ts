import { z } from 'zod';
import {
  ANCHOR_EVENT,
  DEPOSIT_JURISDICTION,
  VENUE_TYPE,
  WEDGE,
} from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Statute                                                           */
/* ------------------------------------------------------------------ */

export const keyProvisionSchema = z.object({
  subsection: z.string().min(1),
  description: z.string().min(1),
});

export type KeyProvision = z.infer<typeof keyProvisionSchema>;

export const statuteSchema = z.object({
  statute_id: z.string().min(1),
  citation: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  key_provisions: z.array(keyProvisionSchema),
  official_url: z.string().url(),
  effective_date: z.string().min(1),
  last_amended: z.string().min(1),
  // Legacy fields (deposit kb entries use these instead)
  id: z.string().min(1).optional(),
  url: z.string().url().optional(),
  full_text: z.string().optional(),
});

export type Statute = z.infer<typeof statuteSchema>;

/* ------------------------------------------------------------------ */
/*  Deadline Rule                                                     */
/* ------------------------------------------------------------------ */

export const deadlinePromptConfigSchema = z.object({
  message: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']),
  cta: z.string().min(1),
  pre_deadline_days: z.number().int().nonnegative(),
});

export type DeadlinePromptConfig = z.infer<typeof deadlinePromptConfigSchema>;

export const deadlineRuleSchema = z.object({
  rule_id: z.string().min(1),
  statute_id: z.string().min(1),
  deadline_days: z.number().int().positive(),
  anchor_event: z.enum(ANCHOR_EVENT),
  action_at_expiry: z.string().min(1),
  description: z.string().min(1),
  prompt_message: z.string().min(1),
  is_statutory: z.boolean(),
  // Legacy fields (deposit kb entries may use prompt_config instead)
  prompt_config: deadlinePromptConfigSchema.optional(),
});

export type DeadlineRule = z.infer<typeof deadlineRuleSchema>;

/* ------------------------------------------------------------------ */
/*  Penalty                                                           */
/* ------------------------------------------------------------------ */

export const penaltySchema = z.object({
  penalty_id: z.string().min(1),
  statute_id: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  amount_or_formula: z.string().min(1),
  conditions: z.string().min(1),
  citation: z.string().optional(),
  // Legacy fields
  id: z.string().min(1).optional(),
  formula: z.string().optional(),
  cap: z.string().optional(),
});

export type Penalty = z.infer<typeof penaltySchema>;

/* ------------------------------------------------------------------ */
/*  Escalation Venue                                                  */
/* ------------------------------------------------------------------ */

export const escalationVenueSchema = z.object({
  venue_id: z.string().min(1),
  type: z.enum(VENUE_TYPE),
  name: z.string().min(1),
  description: z.string().min(1),
  filing_url: z.string().url().optional(),
  // Legacy fields
  id: z.string().min(1).optional(),
  url: z.string().url().optional(),
  jurisdiction_limit: z.string().optional(),
  filing_fee: z.string().optional(),
});

export type EscalationVenue = z.infer<typeof escalationVenueSchema>;

/* ------------------------------------------------------------------ */
/*  Deduction Category                                                */
/* ------------------------------------------------------------------ */

export const deductionCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  statutory_basis: z.string().min(1),
  permissible: z.boolean(),
});

export type DeductionCategory = z.infer<typeof deductionCategorySchema>;

/* ------------------------------------------------------------------ */
/*  Special Provision                                                 */
/* ------------------------------------------------------------------ */

export const specialProvisionSchema = z.object({
  provision_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  statute_ref: z.string().optional(),
  conditions: z.string().optional(),
});

export type SpecialProvision = z.infer<typeof specialProvisionSchema>;

/* ------------------------------------------------------------------ */
/*  Verification                                                      */
/* ------------------------------------------------------------------ */

export const verificationSchema = z.object({
  last_verified: z.string().min(1),
  verified_by: z.string().min(1),
  primary_sources_checked: z.array(z.string().url()),
  next_review_due: z.string().min(1),
  verification_notes: z.string().optional(),
  // Legacy fields
  status: z.enum(['verified', 'needs_review', 'withdrawn']).optional(),
  notes: z.string().optional(),
});

export type Verification = z.infer<typeof verificationSchema>;

/* ------------------------------------------------------------------ */
/*  KB Entry                                                          */
/* ------------------------------------------------------------------ */

export const kbEntrySchema = z.object({
  id: z.string().min(1),
  wedge: z.enum(WEDGE),
  jurisdiction: z.string().min(1),
  jurisdiction_full_name: z.string().min(1).optional(),
  coverage_status: z.string().optional(),
  statutes: z.array(statuteSchema),
  deadline_rules: z.array(deadlineRuleSchema),
  penalties: z.array(penaltySchema),
  escalation_venues: z.array(escalationVenueSchema),
  permissible_deductions: z.array(deductionCategorySchema),
  special_provisions: z.union([
    z.string(),
    z.array(specialProvisionSchema),
  ]).optional(),
  notes: z.string().optional(),
  verification: verificationSchema,
});

export type KbEntry = z.infer<typeof kbEntrySchema>;

/* ------------------------------------------------------------------ */
/*  Packet Template                                                   */
/* ------------------------------------------------------------------ */

export const packetMediationSchema = z.object({
  required: z.boolean(),
  provider: z.string().min(1),
  deadline_days: z.number().int().positive(),
});

export type PacketMediation = z.infer<typeof packetMediationSchema>;

export const packetFeesSchema = z.object({
  filing_fee: z.string().min(1),
  service_fee: z.string().optional(),
  other_fees: z.string().optional(),
});

export type PacketFees = z.infer<typeof packetFeesSchema>;

export const packetTemplateSchema = z.object({
  id: z.string().min(1),
  venue_type: z.enum(VENUE_TYPE),
  jurisdiction: z.enum(DEPOSIT_JURISDICTION),
  county: z.string().optional(),
  forms: z.array(z.string().min(1)),
  attachments_order: z.array(z.string().min(1)),
  filing_instructions: z.string().min(1),
  fees: packetFeesSchema,
  mediation: packetMediationSchema.optional(),
});

export type PacketTemplate = z.infer<typeof packetTemplateSchema>;

/* ------------------------------------------------------------------ */
/*  Vertical Template (matches gym.json, etc.)                        */
/* ------------------------------------------------------------------ */

export const emailLegalCitationsSchema = z.record(z.string(), z.string());

export const emailStepTemplateSchema = z.object({
  subject: z.string().min(1),
  timing: z.string().optional(),
  tone: z.string().min(1),
  key_points: z.array(z.string().min(1)),
  legal_citations: emailLegalCitationsSchema.optional(),
  gym_specific_points: z.array(z.string()).optional(),
});

export type EmailStepTemplate = z.infer<typeof emailStepTemplateSchema>;

export const stateHealthClubLawSchema = z.object({
  statute: z.string().min(1),
  key_provisions: z.array(z.string().min(1)),
  official_url: z.string().url(),
});

export type StateHealthClubLaw = z.infer<typeof stateHealthClubLawSchema>;

export const verticalTemplateSchema = z.object({
  id: z.string().min(1),
  vertical: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().min(1),
  common_companies: z.array(z.string().min(1)),
  typical_barriers: z.array(z.string().min(1)),
  sequence_template: z.object({
    email_1: emailStepTemplateSchema,
    email_2: emailStepTemplateSchema,
    email_3: emailStepTemplateSchema,
  }),
  state_specific_health_club_laws: z.record(z.string(), stateHealthClubLawSchema).optional(),
  notes: z.string().optional(),
});

export type VerticalTemplate = z.infer<typeof verticalTemplateSchema>;

/* ------------------------------------------------------------------ */
/*  Refusal Rule (matches tangled-case-rules.json)                    */
/* ------------------------------------------------------------------ */

export const refusalRuleSchema = z.object({
  rule_id: z.string().min(1),
  wedge: z.string().min(1),
  trigger_question: z.string().nullable(),
  trigger_condition: z.string().optional(),
  affirmative_values: z.array(z.string()).optional(),
  severity: z.enum(['hard_block', 'soft_warning']),
  decline_reason: z.string().min(1),
  resource_type: z.enum(['legal_representation', 'general_info']),
  notes: z.string().optional(),
});

export type RefusalRule = z.infer<typeof refusalRuleSchema>;

export const refusalResourceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().optional(),
  url_template: z.string().optional(),
});

export type RefusalResource = z.infer<typeof refusalResourceSchema>;

export const refusalResourceTemplateSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  resources: z.array(refusalResourceSchema),
});

export type RefusalResourceTemplate = z.infer<typeof refusalResourceTemplateSchema>;

export const tangledCaseRulesSchema = z.object({
  version: z.string().min(1),
  description: z.string().min(1),
  rules: z.array(refusalRuleSchema),
  resource_templates: z.record(z.string(), refusalResourceTemplateSchema),
});

export type TangledCaseRules = z.infer<typeof tangledCaseRulesSchema>;

/* ------------------------------------------------------------------ */
/*  Decline Copy (matches decline-copy.json)                          */
/* ------------------------------------------------------------------ */

export const declineCopyMessageSchema = z.object({
  headline: z.string().min(1),
  explanation: z.string().min(1),
  empathy_line: z.string().min(1),
  what_we_recommend: z.string().min(1),
});

export type DeclineCopyMessage = z.infer<typeof declineCopyMessageSchema>;

export const declineCopyFooterResourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  description: z.string().min(1),
});

export type DeclineCopyFooterResource = z.infer<typeof declineCopyFooterResourceSchema>;

export const declineCopyFooterSchema = z.object({
  disclaimer: z.string().min(1),
  general_resources: z.array(declineCopyFooterResourceSchema),
});

export type DeclineCopyFooter = z.infer<typeof declineCopyFooterSchema>;

export const declineCopySchema = z.object({
  version: z.string().min(1),
  description: z.string().min(1),
  decline_messages: z.record(z.string(), declineCopyMessageSchema),
  common_footer: declineCopyFooterSchema,
});

export type DeclineCopy = z.infer<typeof declineCopySchema>;

/* ------------------------------------------------------------------ */
/*  Adversarial Counsel Trigger (matches adversarial-counsel-trigger) */
/* ------------------------------------------------------------------ */

export const adversarialCounselQuestionSchema = z.object({
  step: z.number().int().positive(),
  question: z.string().min(1),
  field_id: z.string().min(1),
  answer_type: z.enum(['boolean', 'text', 'select']),
  trigger_on: z.union([z.boolean(), z.string()]),
  next_step: z.union([z.number().int().positive(), z.literal('fire_trigger')]),
  non_trigger_action: z.string().min(1),
});

export type AdversarialCounselQuestion = z.infer<typeof adversarialCounselQuestionSchema>;

export const adversarialCounselTriggerResponseSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  reassurance: z.string().min(1),
  action_items: z.array(z.string().min(1)),
  resources: z.string().min(1),
  case_status_update: z.string().min(1),
});

export type AdversarialCounselTriggerResponse = z.infer<typeof adversarialCounselTriggerResponseSchema>;

export const adversarialCounselAuditLogSchema = z.object({
  event_type: z.string().min(1),
  fields_to_log: z.array(z.string().min(1)),
});

export type AdversarialCounselAuditLog = z.infer<typeof adversarialCounselAuditLogSchema>;

export const adversarialCounselTriggerSchema = z.object({
  version: z.string().min(1),
  description: z.string().min(1),
  trigger_id: z.string().min(1),
  priority: z.string().min(1),
  mechanism: z.string().min(1),
  activation_point: z.string().min(1),
  questions: z.array(adversarialCounselQuestionSchema),
  trigger_response: adversarialCounselTriggerResponseSchema,
  audit_log: adversarialCounselAuditLogSchema,
  notes: z.string().optional(),
});

export type AdversarialCounselTrigger = z.infer<typeof adversarialCounselTriggerSchema>;

/* ------------------------------------------------------------------ */
/*  Subscription Base (matches _subscription-base.json)               */
/* ------------------------------------------------------------------ */

export const generationConfigSchema = z.object({
  model: z.string().min(1),
  max_tokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2),
  system_prompt_key: z.string().min(1),
  grounding_mode: z.string().min(1),
  citation_validation: z.boolean(),
  citation_strip_ungrounded: z.boolean(),
});

export type GenerationConfig = z.infer<typeof generationConfigSchema>;

export const sequenceStepConfigSchema = z.object({
  step: z.number().int().positive(),
  name: z.string().min(1),
  timing: z.string().min(1),
  purpose: z.string().min(1),
  tone: z.string().min(1),
  required_elements: z.array(z.string().min(1)),
});

export type SequenceStepConfig = z.infer<typeof sequenceStepConfigSchema>;

export const emailSequenceConfigSchema = z.object({
  type: z.string().min(1),
  steps: z.array(sequenceStepConfigSchema),
});

export type EmailSequenceConfig = z.infer<typeof emailSequenceConfigSchema>;

export const emailPrinciplesSchema = z.object({
  framing: z.string().min(1),
  notes: z.string().optional(),
  prohibited_phrases: z.array(z.string().min(1)),
  permitted_escalation_language: z.array(z.string().min(1)),
});

export type EmailPrinciples = z.infer<typeof emailPrinciplesSchema>;

export const deliveryModeSchema = z.object({
  description: z.string().min(1),
  default: z.boolean().optional(),
  requires_oauth: z.boolean().optional(),
  supported_providers: z.array(z.string()).optional(),
  opt_in_required: z.boolean().optional(),
});

export type DeliveryMode = z.infer<typeof deliveryModeSchema>;

export const cancellationBarrierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  applicable_law: z.string().min(1),
  description: z.string().min(1),
});

export type CancellationBarrier = z.infer<typeof cancellationBarrierSchema>;

export const subscriptionBaseSchema = z.object({
  version: z.string().min(1),
  wedge: z.enum(WEDGE),
  description: z.string().min(1),
  generation_config: generationConfigSchema,
  output_artifacts: z.object({
    email_sequence: emailSequenceConfigSchema,
  }),
  email_principles: emailPrinciplesSchema,
  delivery_modes: z.record(z.string(), deliveryModeSchema),
  common_cancellation_barriers: z.array(cancellationBarrierSchema),
});

export type SubscriptionBase = z.infer<typeof subscriptionBaseSchema>;

/* ------------------------------------------------------------------ */
/*  Disclaimers (matches compliance/disclaimers.json)                 */
/* ------------------------------------------------------------------ */

export const disclaimerSchema = z.object({
  id: z.string().min(1),
  placement: z.string().min(1),
  text: z.string().min(1).optional(),
  body_text: z.string().min(1).optional(),
  style: z.string().min(1),
  dismissible: z.boolean().optional(),
  required: z.boolean().optional(),
  must_be_checked_to_proceed: z.boolean().optional(),
  visible_to: z.string().optional(),
  notes: z.string().optional(),
  subject_line_disclaimer: z.boolean().optional(),
  acknowledgment_stored: z.boolean().optional(),
});

export type Disclaimer = z.infer<typeof disclaimerSchema>;

export const disclaimersFileSchema = z.object({
  version: z.string().min(1),
  last_reviewed: z.string().min(1),
  reviewed_by: z.string().min(1),
  description: z.string().min(1),
  disclaimers: z.record(z.string(), disclaimerSchema),
});

export type DisclaimersFile = z.infer<typeof disclaimersFileSchema>;
