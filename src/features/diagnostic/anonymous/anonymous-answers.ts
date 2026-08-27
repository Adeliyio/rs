/**
 * Pure helpers that translate the in-memory anonymous answer map (keyed by
 * node id, exactly as the diagnostic engine records it) into the payloads the
 * PUBLIC endpoints expect, and into a persistable DiagnosticState for the
 * deposit client → case hydration (SPEC.md M3).
 *
 * No React, no I/O — pure functions so they can be unit-tested directly.
 *
 * Answer shape reminder (from state-manager.advanceState): answers are keyed by
 * NODE ID. `group` nodes store a nested object keyed by sub-field; `boolean`
 * nodes store the string 'true' / 'false'; `select`/`text` store a string;
 * `currency` stores a number.
 */

import type { DiagnosticState } from '@/types/diagnostic.types';
import { VERTICAL, type Vertical } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Small readers                                                     */
/* ------------------------------------------------------------------ */

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (typeof value === 'number') return String(value);
  return undefined;
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** Reads a sub-field from a group-node answer object stored under `nodeId`. */
function groupField(
  answers: Record<string, unknown>,
  nodeId: string,
  field: string,
): unknown {
  const group = answers[nodeId];
  if (group && typeof group === 'object' && !Array.isArray(group)) {
    return (group as Record<string, unknown>)[field];
  }
  return undefined;
}

function isVertical(value: string): value is Vertical {
  return (VERTICAL as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/*  Cancellation payload                                              */
/* ------------------------------------------------------------------ */

/**
 * The POST /api/diagnostic/cancellation request body. Field names + optionality
 * mirror the route's Zod schema; every value is optional except `jurisdiction`.
 */
export interface CancellationPayload {
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
}

/**
 * Maps the subscription-graph in-memory answers to the cancellation endpoint
 * payload. Node ids come from kb/diagnostics/subscription-graph.json.
 */
export function buildCancellationPayload(
  answers: Record<string, unknown>,
): CancellationPayload {
  const jurisdiction = asString(answers.jurisdiction) ?? '';

  const rawVertical = asString(answers.service_vertical);
  const vertical =
    rawVertical && isVertical(rawVertical) ? rawVertical : undefined;

  const barrier = asString(answers.cancellation_difficulty);

  // Build with only defined values so the request body stays minimal and the
  // endpoint's optional-field validation sees only present values.
  const payload: CancellationPayload = { jurisdiction };

  const set = <K extends keyof CancellationPayload>(
    key: K,
    value: CancellationPayload[K] | undefined,
  ): void => {
    if (value !== undefined) payload[key] = value;
  };

  set('vertical', vertical);
  set('company_name', asString(answers.company_name));
  set('service_type', rawVertical);
  set('account_identifier', asString(answers.account_identifier));
  // subscription_details is a group node
  set('billing_email', asString(groupField(answers, 'subscription_details', 'billing_email')));
  set('monthly_charge', asString(groupField(answers, 'subscription_details', 'monthly_charge')));
  set('billing_frequency', asString(groupField(answers, 'subscription_details', 'billing_frequency')));
  set('last_charge_date', asString(groupField(answers, 'subscription_details', 'last_charge_date')));
  set('cancellation_effective_date', asString(answers.cancellation_effective_date));
  set('prior_cancellation_attempt', asBool(answers.cancellation_attempts));
  // cancellation_attempt_details is a group node
  set('cancellation_date', asString(groupField(answers, 'cancellation_attempt_details', 'cancellation_date')));
  set('cancellation_method', asString(groupField(answers, 'cancellation_attempt_details', 'cancellation_method')));
  set('cancellation_result', asString(groupField(answers, 'cancellation_attempt_details', 'cancellation_result')));
  set('wants_refund', asBool(answers.refund_request));
  // refund_details is a group node
  set('refund_amount', asString(groupField(answers, 'refund_details', 'refund_amount')));
  set('refund_reason', asString(groupField(answers, 'refund_details', 'refund_reason')));
  set('cancellation_barriers', barrier ? [barrier] : undefined);

  return payload;
}

/* ------------------------------------------------------------------ */
/*  Deposit jurisdiction + amount readers                             */
/* ------------------------------------------------------------------ */

/** The deposit state code the visitor picked (e.g. 'CA'). */
export function readDepositJurisdiction(
  answers: Record<string, unknown>,
): string | undefined {
  return asString(answers.jurisdiction);
}

/** The deposit amount the visitor entered, if any. */
export function readDepositAmount(
  answers: Record<string, unknown>,
): number | undefined {
  const raw = answers.deposit_amount;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    // An input with no digits (e.g. 'abc') cleans to '' → Number('') is 0, not
    // NaN; treat that as "no amount" rather than $0.
    if (cleaned !== '') {
      const n = Number(cleaned);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Deposit client → case hydration                                   */
/* ------------------------------------------------------------------ */

/**
 * Builds a persistable DiagnosticState from the anonymously-collected answers,
 * positioned at the boundary node the anonymous flow stopped at (the file-upload
 * node), so the authenticated DiagnosticShell resumes exactly where the visitor
 * left off once the real case exists. The collected answers + completed path are
 * carried across verbatim (SPEC.md M3: "answers collected anonymously appear in
 * the created case").
 */
export function buildHydratedState(params: {
  caseId: string;
  graphVersion: string;
  boundaryNodeId: string;
  answers: Record<string, unknown>;
  completedNodes: string[];
}): DiagnosticState {
  const now = new Date().toISOString();
  return {
    case_id: params.caseId,
    graph_version: params.graphVersion,
    current_node: params.boundaryNodeId,
    answers: { ...params.answers },
    completed_nodes: [...params.completedNodes],
    extracted_fields: {},
    is_completed: false,
    started_at: now,
    updated_at: now,
  };
}
