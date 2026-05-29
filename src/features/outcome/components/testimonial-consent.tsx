'use client';

/**
 * Testimonial consent flow — collects outcome, optional testimonial,
 * and consent with identity level selection.
 *
 * Per compliance rules: consent + outcome verification required.
 * Disclaimer: "Individual results vary. This is a writing tool,
 * not legal representation."
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import type { IdentityLevel, OutcomeCategory } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface TestimonialConsentProps {
  caseId: string;
  onComplete: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function TestimonialConsent({
  caseId,
  onComplete,
}: TestimonialConsentProps) {
  const [step, setStep] = useState<'outcome' | 'testimonial' | 'done'>('outcome');
  const [outcomeCategory, setOutcomeCategory] = useState<OutcomeCategory | null>(null);
  const [recoveredAmount, setRecoveredAmount] = useState('');
  const [testimonial, setTestimonial] = useState('');
  const [shareOutcome, setShareOutcome] = useState(false);
  const [shareTestimonial, setShareTestimonial] = useState(false);
  const [identityLevel, setIdentityLevel] = useState<IdentityLevel>('anonymous');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOutcomeSubmit = useCallback(() => {
    if (!outcomeCategory) return;
    setStep('testimonial');
  }, [outcomeCategory]);

  const handleFinalSubmit = useCallback(async () => {
    if (!outcomeCategory) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/cases/${caseId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome_category: outcomeCategory,
          stage: 'resolved',
          recovered_amount: recoveredAmount ? Number(recoveredAmount) : undefined,
          testimonial: testimonial || undefined,
          consent: {
            share_outcome: shareOutcome,
            share_testimonial: shareTestimonial,
            identity_level: identityLevel,
          },
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? 'Failed to save outcome.');
        return;
      }

      setStep('done');
      onComplete();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [caseId, outcomeCategory, recoveredAmount, testimonial, shareOutcome, shareTestimonial, identityLevel, onComplete]);

  if (step === 'done') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="font-semibold text-green-900">Thank you for sharing your outcome.</p>
        <p className="mt-1 text-sm text-green-700">
          Your feedback helps others in similar situations understand what to expect.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Outcome */}
      {step === 'outcome' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">How did it resolve?</h3>

          <div className="space-y-2">
            {([
              { value: 'full_recovery', label: 'Full recovery — got the full amount back' },
              { value: 'partial_recovery', label: 'Partial recovery — got some back' },
              { value: 'no_recovery', label: 'No recovery — did not get money back' },
              { value: 'pending', label: 'Still pending — waiting for resolution' },
            ] as const).map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  outcomeCategory === option.value
                    ? 'border-neutral-900 bg-neutral-50'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="outcome"
                  value={option.value}
                  checked={outcomeCategory === option.value}
                  onChange={() => setOutcomeCategory(option.value)}
                  className="h-4 w-4 text-neutral-900"
                />
                <span className="text-sm text-neutral-800">{option.label}</span>
              </label>
            ))}
          </div>

          {(outcomeCategory === 'full_recovery' || outcomeCategory === 'partial_recovery') && (
            <div>
              <label htmlFor="recovered" className="block text-sm font-medium text-neutral-700">
                Amount recovered ($)
              </label>
              <input
                id="recovered"
                type="number"
                min="0"
                step="0.01"
                value={recoveredAmount}
                onChange={(e) => setRecoveredAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
          )}

          <Button onClick={handleOutcomeSubmit} disabled={!outcomeCategory}>
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Testimonial + Consent */}
      {step === 'testimonial' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">Share your experience</h3>
          <p className="text-sm text-neutral-600">
            This is completely optional. Your experience helps others understand what to expect.
          </p>

          <div>
            <label htmlFor="testimonial" className="block text-sm font-medium text-neutral-700">
              Your experience (optional)
            </label>
            <textarea
              id="testimonial"
              rows={3}
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              placeholder="How was your experience using this tool? What happened after you sent the letter?"
            />
          </div>

          <div className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-medium text-neutral-800">Sharing preferences</p>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={shareOutcome}
                onChange={(e) => setShareOutcome(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700">
                Share my outcome (recovery amount and category) to help others
              </span>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={shareTestimonial}
                onChange={(e) => setShareTestimonial(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-300"
              />
              <span className="text-sm text-neutral-700">
                Share my written experience as a testimonial
              </span>
            </label>

            {(shareOutcome || shareTestimonial) && (
              <div className="ml-7">
                <p className="mb-2 text-xs font-medium text-neutral-600">How to identify you:</p>
                {([
                  { value: 'anonymous', label: 'Anonymous' },
                  { value: 'first_city', label: 'First name + city (e.g., "Jane from Los Angeles")' },
                  { value: 'full', label: 'Full name' },
                ] as const).map((option) => (
                  <label key={option.value} className="flex items-center gap-2 py-1">
                    <input
                      type="radio"
                      name="identity"
                      value={option.value}
                      checked={identityLevel === option.value}
                      onChange={() => setIdentityLevel(option.value)}
                      className="h-3.5 w-3.5 text-neutral-900"
                    />
                    <span className="text-xs text-neutral-700">{option.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-500 italic">
            Individual results vary. This is a writing tool, not legal representation.
            Your information remains private unless you choose to share.
          </p>

          <div className="flex gap-3">
            <Button onClick={handleFinalSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Submit'}
            </Button>
            <Button variant="outline" onClick={() => setStep('outcome')} disabled={isSubmitting}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
