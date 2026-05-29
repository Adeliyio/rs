'use client';

/**
 * 3-step email sequence view for the subscription cancellation wedge.
 *
 * Renders the full sequence with one step active at a time. Sent steps
 * show a green check; future steps show as collapsed with scheduling
 * info. Premium, calm layout: one step at a time, not overwhelming.
 */

import { Shield } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { GeneratedSequence } from '@/types/generation.types';
import { SequenceStep } from './sequence-step';

/* ------------------------------------------------------------------ */
/*  Step names for tab display                                        */
/* ------------------------------------------------------------------ */

const STEP_LABELS: Record<number, string> = {
  1: 'Email 1 — Cancellation Request',
  2: 'Email 2 — Follow-Up',
  3: 'Email 3 — Final Notice',
};

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface SequenceViewProps {
  sequence: GeneratedSequence;
  currentStep: number;
  onMarkSent: (stepNumber: number) => void;
  stepSentDates?: Record<number, string>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function SequenceView({
  sequence,
  currentStep,
  onMarkSent,
  stepSentDates = {},
}: SequenceViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Your Cancellation Email Sequence
        </h2>
        <p className="text-sm text-muted-foreground">
          Three emails, each building on the last. Send them one at a
          time — only move to the next if you do not receive a
          satisfactory response.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-1.5">
        {sequence.steps.map((step) => {
          const isSent = step.step_number < currentStep;
          const isActive = step.step_number === currentStep;

          return (
            <div key={step.step_number} className="flex items-center gap-1.5">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-2 w-16 sm:w-24 rounded-full transition-colors',
                    isSent && 'bg-emerald-500',
                    isActive && 'bg-primary',
                    !isSent && !isActive && 'bg-muted',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    isSent && 'text-emerald-600',
                    isActive && 'text-primary',
                    !isSent && !isActive && 'text-muted-foreground',
                  )}
                >
                  {STEP_LABELS[step.step_number] ?? `Email ${step.step_number}`}
                </span>
              </div>
              {step.step_number < sequence.steps.length && (
                <div className="h-px w-3 bg-border mt-[-14px]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Email steps */}
      <div className="space-y-4">
        {sequence.steps.map((step) => {
          const stepNum = step.step_number;
          let status: 'active' | 'scheduled' | 'sent';

          if (stepNum < currentStep) {
            status = 'sent';
          } else if (stepNum === currentStep) {
            status = 'active';
          } else {
            status = 'scheduled';
          }

          return (
            <SequenceStep
              key={stepNum}
              step={step}
              status={status}
              onMarkSent={
                status === 'active'
                  ? () => onMarkSent(stepNum)
                  : undefined
              }
              sentAt={stepSentDates[stepNum]}
            />
          );
        })}
      </div>

      {/* Disclaimer footer */}
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/30 p-4">
        <Shield className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          These emails were drafted with writing assistance and reference
          publicly available consumer protection information. This is not
          legal advice. Review all content carefully before sending. Verify
          any legal references with official sources. Consider consulting a
          licensed attorney if you have questions about your specific
          situation.
        </p>
      </div>
    </div>
  );
}
