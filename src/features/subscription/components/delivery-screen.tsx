'use client';

/**
 * Delivery screen — the moment of accomplishment.
 *
 * Wraps SequenceView with delivery context: expectation-setting copy,
 * a disclaimer banner, and a "What happens next" timeline. This is
 * shown when case.status === 'generated' for subscription cases.
 *
 * Copy sourced from kb/compliance/expectation-setting-copy.json
 * (delivery_screen_subscription variant).
 */

import { CheckCircle2, Info, Clock, Mail, Shield } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { GeneratedSequence } from '@/types/generation.types';
import { SequenceView } from './sequence-view';
import { useSequence } from '../hooks/use-sequence';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface DeliveryScreenProps {
  caseId: string;
  sequence: GeneratedSequence;
}

/* ------------------------------------------------------------------ */
/*  Timeline step                                                     */
/* ------------------------------------------------------------------ */

interface TimelineStepProps {
  day: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isLast?: boolean;
}

function TimelineStep({
  day,
  title,
  description,
  icon,
  isLast,
}: TimelineStepProps): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        {!isLast && (
          <div className="mt-1 h-full w-px bg-border" />
        )}
      </div>
      <div className={cn('pb-6', isLast && 'pb-0')}>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {day}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function DeliveryScreen({
  caseId,
  sequence: initialSequence,
}: DeliveryScreenProps): React.JSX.Element {
  const {
    sequence: liveSequence,
    currentStep,
    stepSentDates,
    markAsSent,
    isLoading,
  } = useSequence(caseId);

  // Use the live sequence if loaded, otherwise fall back to the server-provided one
  const sequence = liveSequence ?? initialSequence;

  return (
    <div className="page-enter space-y-6">
      {/* Accomplishment header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Your cancellation emails are ready
            </h1>
            <p className="text-sm text-muted-foreground">
              Review your first email below and send it when you are ready.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          This is a writing assistance tool. It generates cancellation emails
          based on applicable consumer protection rules. It does not guarantee
          any specific outcome.
        </p>
      </div>

      {/* Reassurance text */}
      <Card className="border-border/50 shadow-none">
        <CardContent className="px-4 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            People dealing with difficult cancellations commonly escalate
            through written demands citing consumer protection rules. Your
            emails are customized for your specific service and situation.
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Most companies process clearly stated cancellation requests, but
            some resist. That is what the follow-up emails and the regulatory
            complaint option are for.
          </p>
        </CardContent>
      </Card>

      {/* Sequence view */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
        </div>
      ) : (
        <SequenceView
          sequence={sequence}
          currentStep={currentStep}
          onMarkSent={markAsSent}
          stepSentDates={stepSentDates}
        />
      )}

      {/* What happens next timeline */}
      <div className="space-y-4">
        <h3 className="text-base font-medium tracking-tight">
          What happens next
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your sequence: Email 1 today, Email 2 in 7 days if no response,
          Email 3 in 14 days if still no response. Come back to this page
          to access each email when you are ready to send it.
        </p>

        <div className="rounded-lg border bg-card p-4">
          <TimelineStep
            day="Day 0"
            title="Send Email 1 — Cancellation Request"
            description="A clear, professionally written demand referencing the applicable consumer protection rules. Copy the email, paste it into your email client, and send."
            icon={<Mail className="h-4 w-4" />}
          />
          <TimelineStep
            day="Day 7"
            title="Send Email 2 — Follow-Up"
            description="If no confirmation has arrived, send the follow-up. It references your original request and reiterates the legal basis."
            icon={<Clock className="h-4 w-4" />}
          />
          <TimelineStep
            day="Day 14"
            title="Send Email 3 — Final Notice"
            description="A final demand that references the regulatory complaint option. Many companies respond at this stage to avoid a formal complaint."
            icon={<Shield className="h-4 w-4" />}
            isLast
          />
        </div>
      </div>
    </div>
  );
}
