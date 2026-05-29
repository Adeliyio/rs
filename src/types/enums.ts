/* ------------------------------------------------------------------ */
/*  Application enums as const arrays with derived union types        */
/* ------------------------------------------------------------------ */

export const CASE_STATUS = [
  'intake',
  'generated',
  'sent',
  'awaiting',
  'escalation_drafted',
  'resolved',
  'closed',
] as const;
export type CaseStatus = (typeof CASE_STATUS)[number];

export const WEDGE = ['deposit', 'subscription'] as const;
export type Wedge = (typeof WEDGE)[number];

export const DEPOSIT_JURISDICTION = ['CA', 'TX', 'NY', 'FL'] as const;
export type DepositJurisdiction = (typeof DEPOSIT_JURISDICTION)[number];

export const PAYMENT_STATUS = ['pending', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PARSE_STATUS = ['pending', 'parsed', 'confirmed', 'failed'] as const;
export type ParseStatus = (typeof PARSE_STATUS)[number];

export const SUBSCRIPTION_PLAN = ['monthly_unlimited', 'annual_unlimited'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN)[number];

export const SUBSCRIPTION_STATUS = ['active', 'past_due', 'canceled', 'expired'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[number];

export const VERTICAL = ['gym', 'telecom', 'saas', 'streaming', 'mobile_app'] as const;
export type Vertical = (typeof VERTICAL)[number];

export const OUTCOME_CATEGORY = [
  'full_recovery',
  'partial_recovery',
  'no_recovery',
  'pending',
] as const;
export type OutcomeCategory = (typeof OUTCOME_CATEGORY)[number];

export const OUTCOME_STAGE = ['sent', 'response_received', 'resolved', 'closed'] as const;
export type OutcomeStage = (typeof OUTCOME_STAGE)[number];

export const IDENTITY_LEVEL = ['full', 'first_city', 'anonymous'] as const;
export type IdentityLevel = (typeof IDENTITY_LEVEL)[number];

export const ANCHOR_EVENT = [
  'move_out',
  'lease_termination',
  'deposit_paid',
  'landlord_notice_received',
  'tenant_objection_sent',
  'letter_sent',
  'cancellation_requested',
  'last_charge_date',
  'counterparty_response_deadline',
  'complaint_filed',
] as const;
export type AnchorEvent = (typeof ANCHOR_EVENT)[number];

export const REFUSAL_TRIGGER = [
  'adversarial_counsel',
  'eviction',
  'active_litigation',
  'commercial_lease',
  'high_amount',
  'financed_device',
  'government_service',
  'represented_party',
  'habitability_counterclaim',
] as const;
export type RefusalTrigger = (typeof REFUSAL_TRIGGER)[number];

export const VENUE_TYPE = [
  'small_claims',
  'state_ag',
  'consumer_protection',
  'regulatory',
  'federal_agency',
] as const;
export type VenueType = (typeof VENUE_TYPE)[number];

export const JURISDICTION_TIMEZONE: Record<DepositJurisdiction, string> = {
  CA: 'America/Los_Angeles',
  TX: 'America/Chicago',
  NY: 'America/New_York',
  FL: 'America/New_York',
} as const;
