'use client';

/**
 * Letter preview before paywall.
 *
 * Shows the letter structure with one statute visible and the
 * rest masked. Demonstrates the quality and thoroughness of the
 * generated letter to drive conversion.
 *
 * Per IMPLEMENTATION.md: "credibility preview before paywall —
 * show letter structure + one statute masked."
 */

import { Shield, FileText, Scale, CheckCircle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface LetterPreviewProps {
  jurisdiction: string;
  jurisdictionFullName: string;
  depositAmount: number;
  statuteCount: number;
  deadlineCount: number;
  penaltyAvailable: boolean;
  sampleStatuteCitation: string;
  sampleStatuteTitle: string;
  onProceedToPayment: () => void;
  /** Dynamic price label for A/B testing (e.g. "$49", "$59"). Defaults to "$49". */
  priceLabel?: string;
}

/* ------------------------------------------------------------------ */
/*  Masked text helper                                                */
/* ------------------------------------------------------------------ */

function MaskedLine({ width }: { width: string }) {
  return (
    <div
      className="rounded bg-neutral-200"
      style={{ width, height: '12px' }}
      aria-hidden="true"
    />
  );
}

function MaskedParagraph() {
  return (
    <div className="space-y-2 py-2">
      <MaskedLine width="100%" />
      <MaskedLine width="95%" />
      <MaskedLine width="88%" />
      <MaskedLine width="72%" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function LetterPreview({
  jurisdiction,
  jurisdictionFullName,
  depositAmount,
  statuteCount,
  deadlineCount,
  penaltyAvailable,
  sampleStatuteCitation,
  sampleStatuteTitle,
  onProceedToPayment,
  priceLabel = '$49',
}: LetterPreviewProps) {
  return (
    <div className="space-y-6">
      {/* Credibility indicators */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
          <Scale className="mx-auto mb-1 h-5 w-5 text-neutral-600" />
          <div className="text-lg font-bold text-neutral-900">
            {statuteCount}
          </div>
          <div className="text-xs text-neutral-500">
            {jurisdictionFullName} Statutes
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
          <FileText className="mx-auto mb-1 h-5 w-5 text-neutral-600" />
          <div className="text-lg font-bold text-neutral-900">
            {deadlineCount}
          </div>
          <div className="text-xs text-neutral-500">Deadline Rules</div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
          <Shield className="mx-auto mb-1 h-5 w-5 text-neutral-600" />
          <div className="text-lg font-bold text-neutral-900">
            ${depositAmount.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-500">Deposit Amount</div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
          <CheckCircle
            className={`mx-auto mb-1 h-5 w-5 ${penaltyAvailable ? 'text-green-600' : 'text-neutral-400'}`}
          />
          <div className="text-lg font-bold text-neutral-900">
            {penaltyAvailable ? 'Yes' : 'No'}
          </div>
          <div className="text-xs text-neutral-500">Penalty Available</div>
        </div>
      </div>

      {/* Letter preview */}
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-6 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Your Letter Preview — {jurisdiction}
          </h3>
        </div>

        <div className="px-6 py-6 font-serif text-sm leading-relaxed">
          {/* Sender block — masked */}
          <div className="mb-6 space-y-1">
            <MaskedLine width="40%" />
            <MaskedLine width="55%" />
            <MaskedLine width="45%" />
          </div>

          {/* Date — masked */}
          <div className="mb-4">
            <MaskedLine width="25%" />
          </div>

          {/* Recipient — masked */}
          <div className="mb-6 space-y-1">
            <MaskedLine width="35%" />
            <MaskedLine width="50%" />
          </div>

          {/* RE line — visible */}
          <div className="mb-4">
            <p className="font-bold text-neutral-900">
              RE: Demand for Return of Security Deposit
            </p>
            <p className="text-neutral-600">
              Property: [Your Property Address]
            </p>
            <p className="text-neutral-600">
              Security Deposit Paid: ${depositAmount.toLocaleString()}
            </p>
          </div>

          {/* Opening — visible */}
          <p className="mb-4 text-neutral-700">
            Dear [Landlord Name],
          </p>
          <p className="mb-4 text-neutral-700">
            I am writing regarding the security deposit of $
            {depositAmount.toLocaleString()} paid in connection with my tenancy
            at the above-referenced property...
          </p>

          {/* Statute section — one visible */}
          <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold uppercase text-blue-600">
              Statutory Basis (1 of {statuteCount} statutes cited)
            </p>
            <p className="mt-1 text-sm text-neutral-800">
              Under <strong>{sampleStatuteCitation}</strong> ({sampleStatuteTitle}
              ), landlords in {jurisdictionFullName} are required to...
            </p>
          </div>

          {/* Remaining sections — masked */}
          <div className="relative">
            <div className="pointer-events-none select-none opacity-40">
              <MaskedParagraph />
              <MaskedParagraph />
              <MaskedParagraph />
            </div>

            {/* Overlay CTA */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg bg-white px-6 py-4 text-center shadow-lg">
                <p className="mb-3 text-sm font-medium text-neutral-700">
                  Complete letter with all {statuteCount} statutes, itemized
                  disputes, and escalation details
                </p>
                <button
                  type="button"
                  onClick={onProceedToPayment}
                  className="rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                >
                  Unlock Full Letter — {priceLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expectation-setting copy */}
      <p className="text-center text-xs text-neutral-500">
        This tool provides writing assistance and general information, not legal
        advice. Individual results vary. See our refund policy.
      </p>
    </div>
  );
}
