/**
 * Refusal checker — evaluates diagnostic answers against tangled-case rules.
 *
 * Pure logic; no side-effects, no network calls.  Designed to run on the
 * server during diagnostic evaluation, before any generation begins.
 *
 * Iterates through the rules from kb/refusal/tangled-case-rules.json.
 * Returns the first matching hard_block, or the first matching soft_warning
 * if no hard_blocks match.
 */

import { loadRefusalRules } from '@/lib/kb/loader';
import type { RefusalRule } from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export interface RefusalCheckResult {
  triggered: boolean;
  rule?: RefusalRule;
  severity?: 'hard_block' | 'soft_warning';
}

/* ------------------------------------------------------------------ */
/*  Condition evaluator                                               */
/* ------------------------------------------------------------------ */

/**
 * Evaluates a trigger_condition string against the answers map.
 *
 * Supported patterns:
 *   "case.<field> > <number>"
 *   "case.<field> < <number>"
 *   "case.<field> >= <number>"
 *   "case.<field> <= <number>"
 *   "case.<field> == <value>"
 *
 * Returns `false` for any pattern we cannot parse (fail-open so the
 * user is never incorrectly blocked).
 */
function evaluateCondition(
  condition: string,
  answers: Record<string, unknown>,
): boolean {
  const match = condition.match(
    /^case\.(\w+)\s*(>|<|>=|<=|==|!=)\s*(.+)$/,
  );
  if (!match) return false;

  const [, field, operator, rawValue] = match;
  if (!field || !operator || !rawValue) return false;

  const answerValue = answers[field];
  if (answerValue === undefined || answerValue === null) return false;

  // Numeric comparison
  const numericThreshold = Number(rawValue);
  if (!Number.isNaN(numericThreshold)) {
    const numericAnswer = Number(answerValue);
    if (Number.isNaN(numericAnswer)) return false;

    switch (operator) {
      case '>':
        return numericAnswer > numericThreshold;
      case '<':
        return numericAnswer < numericThreshold;
      case '>=':
        return numericAnswer >= numericThreshold;
      case '<=':
        return numericAnswer <= numericThreshold;
      case '==':
        return numericAnswer === numericThreshold;
      case '!=':
        return numericAnswer !== numericThreshold;
      default:
        return false;
    }
  }

  // String equality fallback
  const trimmedValue = rawValue.replace(/^['"]|['"]$/g, '').trim();
  const stringAnswer = String(answerValue).trim();

  switch (operator) {
    case '==':
      return stringAnswer === trimmedValue;
    case '!=':
      return stringAnswer !== trimmedValue;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Rule matcher                                                      */
/* ------------------------------------------------------------------ */

function ruleMatches(
  rule: RefusalRule,
  answers: Record<string, unknown>,
): boolean {
  // Question-based trigger
  if (rule.trigger_question && rule.affirmative_values) {
    // Find the answer keyed by the full question text or a matching field id
    // The diagnostic may store answers keyed by question text or by field id.
    const answerByQuestion = answers[rule.trigger_question];
    if (answerByQuestion !== undefined && answerByQuestion !== null) {
      const normalized = String(answerByQuestion).toLowerCase().trim();
      return rule.affirmative_values.some(
        (v) => v.toLowerCase().trim() === normalized,
      );
    }

    // Also check if any answer value matches (handles field-id keying)
    // We iterate values because we don't know the exact key mapping
    return false;
  }

  // Condition-based trigger (e.g. "case.deposit_amount > 25000")
  if (rule.trigger_condition) {
    return evaluateCondition(rule.trigger_condition, answers);
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Check diagnostic answers against all refusal rules for the given wedge.
 *
 * @param answers  The diagnostic state answers map.
 * @param wedge    The current case wedge (e.g. "deposit", "subscription").
 * @returns        A `RefusalCheckResult` indicating whether a rule fired.
 */
export function checkRefusal(
  answers: Record<string, unknown>,
  wedge: string,
): RefusalCheckResult {
  const { rules } = loadRefusalRules();

  let softWarningMatch: RefusalRule | undefined;

  for (const rule of rules) {
    // Skip rules that don't apply to this wedge
    if (rule.wedge !== wedge && rule.wedge !== 'any') {
      continue;
    }

    if (!ruleMatches(rule, answers)) {
      continue;
    }

    // Hard blocks return immediately — first match wins
    if (rule.severity === 'hard_block') {
      return {
        triggered: true,
        rule,
        severity: 'hard_block',
      };
    }

    // Track the first soft_warning; we keep scanning for hard_blocks
    if (rule.severity === 'soft_warning' && !softWarningMatch) {
      softWarningMatch = rule;
    }
  }

  // Return soft_warning if one matched but no hard_block did
  if (softWarningMatch) {
    return {
      triggered: true,
      rule: softWarningMatch,
      severity: 'soft_warning',
    };
  }

  return { triggered: false };
}
