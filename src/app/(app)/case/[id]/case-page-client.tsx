'use client';

/**
 * Client wrapper for post-generation case statuses.
 *
 * Handles interactive flows:
 * - CaseDetail with wired action buttons
 * - OutcomePrompt (time-based check-ins)
 * - AdversarialCounselFlow (report-response safety gate)
 * - EscalationFlow (post-deadline filing)
 * - TestimonialConsent (resolved outcome capture)
 */

import { useState, useCallback } from 'react';

import { CaseDetail } from '@/components/dashboard/case-detail';
import type { CaseDetailData, CaseDetailActions } from '@/components/dashboard/case-detail';
import AdversarialCounselFlow from '@/features/diagnostic/components/adversarial-counsel-flow';
import { EscalationFlow } from '@/features/deposit/components/escalation-flow';
import OutcomePrompt from '@/features/outcome/components/outcome-prompt';
import { TestimonialConsent } from '@/features/outcome/components/testimonial-consent';
import type { CaseStatus } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface CasePageClientProps {
  caseId: string;
  caseDetailData: CaseDetailData;
  status: CaseStatus;
  sentAt?: string;
  hasRefusal: boolean;
  /** Whether the statutory deadline has expired (for escalation). */
  deadlineExpired?: boolean;
  /** Available counties for small-claims filing. */
  availableCounties?: string[];
  /** Jurisdiction string (e.g., "CA"). */
  jurisdiction?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function CasePageClient({
  caseId,
  caseDetailData,
  status,
  sentAt,
  hasRefusal: _hasRefusal,
  deadlineExpired = false,
  availableCounties = [],
  jurisdiction = '',
}: CasePageClientProps): React.JSX.Element {
  const [showAdversarialFlow, setShowAdversarialFlow] = useState(false);
  const [showEscalation, setShowEscalation] = useState(false);
  const [showTestimonial, setShowTestimonial] = useState(false);

  /* ---- Adversarial counsel flow ---- */
  const handleReportResponse = useCallback(() => {
    setShowAdversarialFlow(true);
  }, []);

  const handleAdversarialComplete = useCallback(() => {
    setShowAdversarialFlow(false);
  }, []);

  const handleAdversarialTrigger = useCallback(() => {
    window.location.reload();
  }, []);

  /* ---- Escalation flow ---- */
  const handleShowEscalation = useCallback(() => {
    setShowEscalation(true);
  }, []);

  const handleEscalationFiled = useCallback(() => {
    window.location.reload();
  }, []);

  /* ---- Testimonial consent ---- */
  const handleShareExperience = useCallback(() => {
    setShowTestimonial(true);
  }, []);

  const handleTestimonialComplete = useCallback(() => {
    setShowTestimonial(false);
    window.location.reload();
  }, []);

  /* ---- CaseDetail action callbacks ---- */
  const actions: CaseDetailActions = {
    onReportResponse: handleReportResponse,
    onShareExperience: handleShareExperience,
  };

  /* ---------------------------------------------------------------- */
  /*  Render: adversarial counsel flow (full-screen takeover)         */
  /* ---------------------------------------------------------------- */

  if (showAdversarialFlow) {
    return (
      <AdversarialCounselFlow
        caseId={caseId}
        onTriggerFired={handleAdversarialTrigger}
        onComplete={handleAdversarialComplete}
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: escalation flow (full-screen takeover)                  */
  /* ---------------------------------------------------------------- */

  if (showEscalation) {
    return (
      <EscalationFlow
        caseId={caseId}
        jurisdiction={jurisdiction}
        availableCounties={availableCounties}
        onMarkFiled={handleEscalationFiled}
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: testimonial consent (full-screen takeover)              */
  /* ---------------------------------------------------------------- */

  if (showTestimonial) {
    return (
      <div className="space-y-4">
        <TestimonialConsent
          caseId={caseId}
          onComplete={handleTestimonialComplete}
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                     */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <CaseDetail caseData={caseDetailData} actions={actions} />

      {/* Escalation prompt — shown when awaiting + deadline expired */}
      {status === 'awaiting' && deadlineExpired && caseDetailData.wedge === 'deposit' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-0.5 shrink-0 rounded-full bg-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                The statutory deadline has passed
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                Your landlord did not respond within the required timeframe.
                You may now escalate by filing in small claims court or with
                the state attorney general.
              </p>
            </div>
            <button
              type="button"
              onClick={handleShowEscalation}
              className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-200"
            >
              Begin Escalation
            </button>
          </div>
        </div>
      )}

      <OutcomePrompt
        caseId={caseId}
        status={status}
        sentAt={sentAt}
        onReportResponse={handleReportResponse}
      />
    </div>
  );
}
