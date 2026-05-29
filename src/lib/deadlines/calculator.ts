/**
 * Deadline calculator — server-only.
 *
 * Computes concrete deadline dates from diagnostic answers and
 * KB deadline rules. Each rule specifies a number of days from
 * an anchor event (e.g., move_out, letter_sent).
 *
 * The calculator resolves anchor events to actual dates from the
 * diagnostic answers, then adds the deadline_days to get the
 * concrete deadline date.
 */

import { addDays, differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { DeadlineRule } from '@/types/kb.types';
import type { AnchorEvent } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ComputedDeadline {
  rule_id: string;
  statute_id: string;
  anchor_event: AnchorEvent;
  anchor_date: Date;
  deadline_date: Date;
  deadline_days: number;
  days_remaining: number;
  is_expired: boolean;
  is_statutory: boolean;
  prompt_message: string;
  description: string;
  action_at_expiry: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface DeadlineComputationResult {
  deadlines: ComputedDeadline[];
  errors: string[];
}

/* ------------------------------------------------------------------ */
/*  Anchor event resolution                                           */
/* ------------------------------------------------------------------ */

interface AnchorDates {
  move_out?: string;
  lease_termination?: string;
  deposit_paid?: string;
  landlord_notice_received?: string;
  tenant_objection_sent?: string;
  letter_sent?: string;
  cancellation_requested?: string;
  last_charge_date?: string;
  counterparty_response_deadline?: string;
  complaint_filed?: string;
  [key: string]: string | undefined;
}

/**
 * Resolves an anchor event to a concrete date from diagnostic answers.
 * Returns null if the anchor date is not available in the answers.
 */
function resolveAnchorDate(
  anchorEvent: AnchorEvent,
  answers: AnchorDates,
): Date | null {
  const dateStr = answers[anchorEvent];
  if (!dateStr) return null;

  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) return null;

  return parsed;
}

/* ------------------------------------------------------------------ */
/*  Severity calculation                                              */
/* ------------------------------------------------------------------ */

function computeSeverity(
  daysRemaining: number,
  isStatutory: boolean,
): 'info' | 'warning' | 'critical' {
  if (daysRemaining <= 0) return 'critical';
  if (isStatutory && daysRemaining <= 7) return 'warning';
  if (!isStatutory && daysRemaining <= 3) return 'warning';
  return 'info';
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Computes concrete deadlines from KB deadline rules and diagnostic answers.
 *
 * @param rules  Deadline rules from the KB entry.
 * @param answers  Diagnostic answers containing anchor dates.
 * @param timezone  IANA timezone string (e.g., 'America/Los_Angeles').
 * @returns  Computed deadlines sorted by deadline_date, plus any errors.
 */
export function computeDeadlines(
  rules: DeadlineRule[],
  answers: AnchorDates,
  timezone: string,
): DeadlineComputationResult {
  const deadlines: ComputedDeadline[] = [];
  const errors: string[] = [];

  const now = toZonedTime(new Date(), timezone);

  for (const rule of rules) {
    const anchorDate = resolveAnchorDate(
      rule.anchor_event as AnchorEvent,
      answers,
    );

    if (!anchorDate) {
      // Anchor date not available — skip this rule
      // This is normal: not all anchor events have dates yet
      // (e.g., letter_sent before a letter is sent)
      continue;
    }

    const deadlineDate = addDays(anchorDate, rule.deadline_days);
    const daysRemaining = differenceInCalendarDays(deadlineDate, now);
    const isExpired = daysRemaining < 0;
    const severity = computeSeverity(daysRemaining, rule.is_statutory);

    deadlines.push({
      rule_id: rule.rule_id,
      statute_id: rule.statute_id,
      anchor_event: rule.anchor_event as AnchorEvent,
      anchor_date: anchorDate,
      deadline_date: deadlineDate,
      deadline_days: rule.deadline_days,
      days_remaining: Math.max(daysRemaining, 0),
      is_expired: isExpired,
      is_statutory: rule.is_statutory,
      prompt_message: rule.prompt_message,
      description: rule.description,
      action_at_expiry: rule.action_at_expiry,
      severity,
    });
  }

  // Sort by deadline_date ascending (most urgent first)
  deadlines.sort(
    (a, b) => a.deadline_date.getTime() - b.deadline_date.getTime(),
  );

  return { deadlines, errors };
}

/**
 * Filters deadlines to only those that should trigger a prompt
 * (upcoming within the prompt window or already expired).
 *
 * @param deadlines  All computed deadlines.
 * @param promptWindowDays  How many days before the deadline to start prompting.
 * @returns  Deadlines that should trigger prompts.
 */
export function getActionableDeadlines(
  deadlines: ComputedDeadline[],
  promptWindowDays = 7,
): ComputedDeadline[] {
  return deadlines.filter(
    (d) => d.is_expired || d.days_remaining <= promptWindowDays,
  );
}
