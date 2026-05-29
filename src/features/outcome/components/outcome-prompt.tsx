'use client';

/**
 * Outcome tracking prompts — shown inline when a case is in the
 * 'sent' or 'awaiting' status.
 *
 * Displays contextual check-in prompts based on time since the letter
 * was sent. Follows PRD Principle 10: calm, supportive tone.
 *
 * For Phase 2: renders prompts inline only. Email delivery of prompts
 * is Phase 3.
 */

import { useState } from 'react';
import { MessageSquare, Clock, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TestimonialConsent } from '@/features/outcome/components/testimonial-consent';
import type { CaseStatus } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface OutcomePromptProps {
  caseId: string;
  status: CaseStatus;
  sentAt?: string;
  onReportResponse?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function daysSince(dateStr: string): number {
  const sent = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - sent.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

type PromptPhase = 'too_early' | 'check_response' | 'check_changed' | 'capture_outcome';

function getPromptPhase(daysSinceSent: number): PromptPhase {
  if (daysSinceSent < 14) return 'too_early';
  if (daysSinceSent < 30) return 'check_response';
  if (daysSinceSent < 60) return 'check_changed';
  return 'capture_outcome';
}

/* ------------------------------------------------------------------ */
/*  Sub-components for each prompt phase                              */
/* ------------------------------------------------------------------ */

function CheckResponsePrompt({
  onYes,
  onNo,
}: {
  onYes: () => void;
  onNo: () => void;
}): React.JSX.Element {
  return (
    <Card className="border-border/50 shadow-none">
      <CardContent className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Have you received a response?
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                It has been about two weeks since your first email was sent.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onNo}>
                No, not yet
              </Button>
              <Button size="sm" onClick={onYes}>
                Yes, I received a response
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckChangedPrompt({
  onYes,
  onNo,
  onResolved,
}: {
  onYes: () => void;
  onNo: () => void;
  onResolved: () => void;
}): React.JSX.Element {
  return (
    <Card className="border-border/50 shadow-none">
      <CardContent className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Has anything changed?
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                It has been about a month. We want to make sure you have the
                support you need.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onNo}>
                Still waiting
              </Button>
              <Button size="sm" variant="outline" onClick={onYes}>
                Got a response
              </Button>
              <Button size="sm" onClick={onResolved}>
                Issue resolved
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CaptureOutcomePrompt({
  onResolved,
  onNoResponse,
  onPartial,
}: {
  onResolved: () => void;
  onNoResponse: () => void;
  onPartial: () => void;
}): React.JSX.Element {
  return (
    <Card className="border-border/50 shadow-none">
      <CardContent className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                How did this resolve?
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                It has been over 60 days. Let us know the outcome so we can
                close your case properly.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onResolved}>
                Fully resolved
              </Button>
              <Button size="sm" variant="outline" onClick={onPartial}>
                Partially resolved
              </Button>
              <Button size="sm" variant="outline" onClick={onNoResponse}>
                No response at all
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DismissedMessage(): React.JSX.Element {
  return (
    <Card className="border-border/50 shadow-none">
      <CardContent className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              No worries — we will check in again
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
              If no response arrives within the statutory period, we can prepare
              escalation documents. In the meantime, continue sending the
              remaining emails in your sequence if you have not already.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function OutcomePrompt({
  caseId,
  status,
  sentAt,
  onReportResponse,
}: OutcomePromptProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);
  const [, setUpdatingStatus] = useState(false);
  const [showTestimonial, setShowTestimonial] = useState(false);

  // Only show for sent/awaiting statuses
  if (status !== 'sent' && status !== 'awaiting') {
    return null;
  }

  // If no sentAt, we can't calculate timing — show nothing
  if (!sentAt) {
    return null;
  }

  const days = daysSince(sentAt);
  const phase = getPromptPhase(days);

  // Too early — nothing to show
  if (phase === 'too_early') {
    return null;
  }

  // Dismissed — show "we'll check in again"
  if (dismissed) {
    return <DismissedMessage />;
  }

  /* -------------------------------------------------------------- */
  /*  Handlers                                                      */
  /* -------------------------------------------------------------- */

  const handleYesResponse = () => {
    onReportResponse?.();
  };

  const handleNoResponse = () => {
    setDismissed(true);
  };

  const handleResolvedIntent = () => {
    // Show testimonial consent before marking resolved
    setShowTestimonial(true);
  };

  const handleTestimonialComplete = async () => {
    // After testimonial is captured, mark the case as resolved
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: 'resolved' }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // eslint-disable-next-line no-console
      console.error('Failed to update case status to resolved');
    } finally {
      setUpdatingStatus(false);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Render: Testimonial consent                                   */
  /* -------------------------------------------------------------- */

  if (showTestimonial) {
    return (
      <TestimonialConsent
        caseId={caseId}
        onComplete={handleTestimonialComplete}
      />
    );
  }

  /* -------------------------------------------------------------- */
  /*  Render: Phase-based prompts                                   */
  /* -------------------------------------------------------------- */

  if (phase === 'check_response') {
    return (
      <CheckResponsePrompt
        onYes={handleYesResponse}
        onNo={handleNoResponse}
      />
    );
  }

  if (phase === 'check_changed') {
    return (
      <CheckChangedPrompt
        onYes={handleYesResponse}
        onNo={handleNoResponse}
        onResolved={handleResolvedIntent}
      />
    );
  }

  // capture_outcome
  return (
    <CaptureOutcomePrompt
      onResolved={handleResolvedIntent}
      onNoResponse={handleNoResponse}
      onPartial={handleResolvedIntent}
    />
  );
}
