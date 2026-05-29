/**
 * Adversarial-counsel detection — the single highest-UPL-risk moment
 * in the product (PRD §6.7 part 3).
 *
 * Implements the 3-step explicit branching question flow loaded from
 * kb/refusal/adversarial-counsel-trigger.json.
 *
 * This runs AFTER the user has sent their letter and reports a
 * counterparty response — not during the initial diagnostic.
 */

import { loadAdversarialCounselTrigger } from '@/lib/kb/loader';
import type { AdversarialCounselQuestion } from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

/** Returned when there is still a question to ask. */
export interface AdversarialCounselPendingStep {
  step: number;
  question: string;
  field_id: string;
  should_fire: false;
}

/** Returned when the trigger should fire (user answered a trigger_on value). */
export interface AdversarialCounselFiredStep {
  step: number;
  should_fire: true;
}

/** Returned when all questions answered with no trigger. */
export interface AdversarialCounselCompleteStep {
  step: number;
  should_fire: false;
  complete: true;
}

export type AdversarialCounselStep =
  | AdversarialCounselPendingStep
  | AdversarialCounselFiredStep
  | AdversarialCounselCompleteStep;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function answerMatchesTrigger(
  answer: unknown,
  triggerOn: boolean | string,
): boolean {
  if (typeof triggerOn === 'boolean') {
    // Normalise answer to boolean — support "yes"/"true"/true
    if (typeof answer === 'boolean') return answer === triggerOn;
    if (typeof answer === 'string') {
      const lower = answer.toLowerCase().trim();
      const booleanised = lower === 'yes' || lower === 'true';
      return booleanised === triggerOn;
    }
    return false;
  }

  // String-based trigger_on
  return String(answer).toLowerCase().trim() === triggerOn.toLowerCase().trim();
}

/* ------------------------------------------------------------------ */
/*  Core functions                                                    */
/* ------------------------------------------------------------------ */

/**
 * Determine which step of the adversarial-counsel flow the user is on
 * based on which field_ids already have answers.
 *
 * Walk through the questions in order:
 *   - If the field has no answer yet → return the current question (pending).
 *   - If the field's answer matches `trigger_on` → fire the trigger.
 *   - If the field's answer does NOT match `trigger_on`:
 *       - If non_trigger_action is "continue_normal_flow" → complete (no trigger).
 *       - Otherwise → advance to the next step.
 *
 * @param answers  Map of field_id → user answer collected so far.
 */
export function getAdversarialCounselStep(
  answers: Record<string, unknown>,
): AdversarialCounselStep {
  const trigger = loadAdversarialCounselTrigger();
  const questions: AdversarialCounselQuestion[] = trigger.questions;

  for (const q of questions) {
    const answer = answers[q.field_id];

    // No answer yet — this is the current question to ask
    if (answer === undefined || answer === null) {
      return {
        step: q.step,
        question: q.question,
        field_id: q.field_id,
        should_fire: false,
      };
    }

    // Answer matches trigger → fire
    if (answerMatchesTrigger(answer, q.trigger_on)) {
      return {
        step: q.step,
        should_fire: true,
      };
    }

    // Answer does NOT match trigger
    if (q.non_trigger_action === 'continue_normal_flow') {
      return {
        step: q.step,
        should_fire: false,
        complete: true,
      };
    }

    // Otherwise the non_trigger_action is "continue_to_step_N" — loop to next question
  }

  // All questions answered with no trigger
  const lastQuestion = questions[questions.length - 1];
  return {
    step: lastQuestion?.step ?? 3,
    should_fire: false,
    complete: true,
  };
}

/**
 * Convenience: returns `true` if any answered field_id already
 * triggered the adversarial counsel rule.
 */
export function shouldFireAdversarialTrigger(
  answers: Record<string, unknown>,
): boolean {
  const result = getAdversarialCounselStep(answers);
  return result.should_fire;
}
