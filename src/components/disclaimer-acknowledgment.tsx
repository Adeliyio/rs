'use client';

/**
 * Pre-generation disclaimer acknowledgment — blocking checkbox.
 *
 * Required before letter or sequence generation can proceed.
 * Sources copy from kb/compliance/disclaimers.json.
 * The user must check the box to unlock the generate button.
 */

import { useState, useCallback } from 'react';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface DisclaimerAcknowledgmentProps {
  onAcknowledge: () => void;
  onCancel?: () => void;
  wedge: 'deposit' | 'subscription';
  isLoading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Disclaimer text                                                   */
/* ------------------------------------------------------------------ */

const DISCLAIMER_TEXT =
  'I understand that this tool provides writing assistance and general information about how similar disputes are typically handled. It does not provide legal advice, does not evaluate whether I have a valid claim, and does not guarantee any outcome. The generated letter is a starting point that I should review and may want to have reviewed by a licensed attorney before sending. I am responsible for verifying the accuracy of all information and for my own decisions about how to proceed.';

const GENERATE_LABELS: Record<string, string> = {
  deposit: 'Generate Demand Letter',
  subscription: 'Generate Email Sequence',
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function DisclaimerAcknowledgment({
  onAcknowledge,
  onCancel,
  wedge,
  isLoading = false,
}: DisclaimerAcknowledgmentProps) {
  const [checked, setChecked] = useState(false);

  const handleCheck = useCallback(() => {
    setChecked((prev) => !prev);
  }, []);

  const handleProceed = useCallback(() => {
    if (checked) {
      onAcknowledge();
    }
  }, [checked, onAcknowledge]);

  return (
    <div className="rounded-2xl border border-[#E8E8E5] bg-white p-8 shadow-premium">
      <h3 className="mb-5 text-[18px] font-semibold text-[#111]">
        Before We Generate
      </h3>

      <div className="mb-6 rounded-xl bg-amber-50/60 border border-amber-200/60 p-5">
        <p className="text-[14px] leading-[1.7] text-[#5F5F5F]">
          {DISCLAIMER_TEXT}
        </p>
      </div>

      <label className="mb-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleCheck}
          className="mt-0.5 h-5 w-5 rounded border-[#E8E8E5] text-[#111] focus:ring-primary"
          aria-label="I acknowledge and understand the disclaimer"
        />
        <span className="text-[14px] font-medium text-[#111]">
          I have read and understand the above
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleProceed}
          disabled={!checked || isLoading}
          className="rounded-lg bg-[#111] px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#222] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E8E8E5] disabled:text-[#8A8A8A] disabled:active:scale-100"
        >
          {isLoading
            ? 'Generating...'
            : GENERATE_LABELS[wedge] ?? 'Generate'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-[#E8E8E5] px-6 py-2.5 text-[14px] font-medium text-[#5F5F5F] transition-all hover:bg-[#F7F7F5] hover:text-[#111] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
