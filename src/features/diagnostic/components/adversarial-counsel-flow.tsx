'use client';

/**
 * Adversarial-counsel branching flow — the single highest-UPL-risk
 * moment in the product (PRD §6.7).
 *
 * Renders a calm, 3-step yes/no question flow.  Shown inside the case
 * view when the user clicks "Report Response" after sending a letter.
 *
 * - Step 1 "No"  → onComplete (no trigger, continue normally)
 * - Step 2 "Yes" → fire trigger → show decline screen
 * - Step 3 "Yes" → fire trigger
 * - Step 3 "No"  → onComplete (no attorney involved)
 */

import { useState, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';

import DeclineScreen from './decline-screen';

/* ------------------------------------------------------------------ */
/*  Constants: The 3-step questions (mirroring the KB JSON)           */
/* ------------------------------------------------------------------ */

interface BranchQuestion {
  step: number;
  question: string;
  field_id: string;
  /** If the user answers "yes" on a trigger step, fire the trigger. */
  yes_fires: boolean;
  /** What happens if "No" — either advance to a step or complete. */
  no_action: 'complete' | number;
  /** What happens if "Yes" — either fire or advance to a step. */
  yes_action: 'fire' | number;
}

const QUESTIONS: BranchQuestion[] = [
  {
    step: 1,
    question:
      'Has the other party or anyone representing them contacted you since you sent the letter?',
    field_id: 'counterparty_responded',
    yes_fires: false,
    yes_action: 2,
    no_action: 'complete',
  },
  {
    step: 2,
    question:
      'Did they mention a lawyer, an attorney, or legal action?',
    field_id: 'attorney_mentioned',
    yes_fires: true,
    yes_action: 'fire',
    no_action: 3,
  },
  {
    step: 3,
    question:
      'Did they threaten to sue you, file a countersuit, or take you to court?',
    field_id: 'countersuit_threatened',
    yes_fires: true,
    yes_action: 'fire',
    no_action: 'complete',
  },
];

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface AdversarialCounselFlowProps {
  caseId: string;
  /** Called when the trigger fires — parent should update case status. */
  onTriggerFired: () => void;
  /** Called when the flow completes with no trigger — safe to continue. */
  onComplete: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function AdversarialCounselFlow({
  caseId,
  onTriggerFired,
  onComplete,
}: AdversarialCounselFlowProps): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState(1);
  const [triggered, setTriggered] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* -------------------------------------------------------------- */
  /*  Fire the trigger via API                                      */
  /* -------------------------------------------------------------- */

  const fireTrigger = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/refusal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refusal_trigger: 'adversarial_counsel',
        }),
      });

      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error('Failed to record refusal trigger:', res.status);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to record refusal trigger:', err);
    } finally {
      setTriggered(true);
      setIsSubmitting(false);
    }
  }, [caseId]);

  /* -------------------------------------------------------------- */
  /*  Handle answer                                                 */
  /* -------------------------------------------------------------- */

  const handleAnswer = useCallback(
    (answer: boolean) => {
      const question = QUESTIONS.find((q) => q.step === currentStep);
      if (!question) return;

      if (answer) {
        // "Yes"
        if (question.yes_action === 'fire') {
          void fireTrigger();
        } else {
          setCurrentStep(question.yes_action);
        }
      } else {
        // "No"
        if (question.no_action === 'complete') {
          onComplete();
        } else {
          setCurrentStep(question.no_action);
        }
      }
    },
    [currentStep, fireTrigger, onComplete],
  );

  /* -------------------------------------------------------------- */
  /*  Triggered → show decline screen                               */
  /* -------------------------------------------------------------- */

  if (triggered) {
    return (
      <DeclineScreen
        ruleId="adversarial-counsel-engaged"
        resourceType="legal_representation"
        onClose={onTriggerFired}
      />
    );
  }

  /* -------------------------------------------------------------- */
  /*  Active question                                               */
  /* -------------------------------------------------------------- */

  const question = QUESTIONS.find((q) => q.step === currentStep);
  if (!question) {
    // Safety fallback — should not happen
    onComplete();
    return <></>;
  }

  /* Step progress indicator */
  const totalSteps = QUESTIONS.length;

  return (
    <div className="page-enter mx-auto max-w-lg px-4 py-8">
      {/* Progress dots */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {QUESTIONS.map((q) => (
          <div
            key={q.step}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              q.step === currentStep
                ? 'w-8 bg-primary'
                : q.step < currentStep
                  ? 'w-4 bg-primary/40'
                  : 'w-4 bg-border',
            )}
          />
        ))}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="space-y-6 p-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                'bg-muted text-muted-foreground',
              )}
            >
              <ShieldAlert className="h-6 w-6" />
            </div>
          </div>

          {/* Context header (shown on step 1 only) */}
          {currentStep === 1 && (
            <p className="text-center text-xs text-muted-foreground">
              Before we continue, we need to check a few things to make
              sure we can still help.
            </p>
          )}

          {/* Question */}
          <h2 className="text-center text-lg font-medium leading-snug text-foreground">
            {question.question}
          </h2>

          {/* Step indicator */}
          <p className="text-center text-xs text-muted-foreground">
            Question {currentStep} of {totalSteps}
          </p>

          {/* Yes / No buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => handleAnswer(false)}
            >
              No
            </Button>
            <Button
              variant="default"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => handleAnswer(true)}
            >
              {isSubmitting ? 'Processing...' : 'Yes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
