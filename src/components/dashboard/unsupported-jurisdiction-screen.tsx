'use client';

/**
 * Unsupported-jurisdiction screen — shown when a deposit user's
 * state is not yet covered (i.e., not CA/TX/NY/FL).
 *
 * Provides free value per PRD §6.6 and §7.9:
 * 1. Explains why coverage is limited
 * 2. Renders the generic demand letter template for download
 * 3. Shows state-specific resource links (statute, small claims, legal aid, AG)
 * 4. Captures a waitlist email to signal demand
 */

import { useState, useCallback } from 'react';
import { FileText, ExternalLink, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface StateResources {
  name: string;
  deposit_statute: string;
  deposit_statute_url: string;
  small_claims_url: string;
  legal_aid_url: string;
  ag_complaint_url: string;
}

interface UnsupportedJurisdictionScreenProps {
  state: string;
  stateResources: StateResources | null;
  genericLetterUrl: string;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function UnsupportedJurisdictionScreen({
  state,
  stateResources,
  genericLetterUrl,
  onBack,
}: UnsupportedJurisdictionScreenProps): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [waitlistMessage, setWaitlistMessage] = useState('');

  const handleWaitlistSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim()) return;

      setWaitlistStatus('loading');
      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, state, wedge: 'deposit' }),
        });

        const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };

        if (response.ok && data.ok) {
          setWaitlistStatus('success');
          setWaitlistMessage(data.message ?? 'You have been added to the waitlist.');
        } else {
          setWaitlistStatus('error');
          setWaitlistMessage(data.error ?? 'Something went wrong. Please try again.');
        }
      } catch {
        setWaitlistStatus('error');
        setWaitlistMessage('Network error. Please try again.');
      }
    },
    [email, state],
  );

  const stateName = stateResources?.name ?? state;

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to state selection
        </button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {stateName} Coverage Coming Soon
          </h1>
          <p className="mt-2 text-base text-muted-foreground leading-relaxed">
            We don&apos;t yet offer state-specific deposit recovery for {stateName}.
            Our generated letters require jurisdiction-specific statutes, deadlines,
            and penalty calculations that we haven&apos;t yet validated for your state.
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            In the meantime, here&apos;s what we can offer for free:
          </p>
        </div>

        {/* Generic demand letter download */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Generic Demand Letter Template</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                A general-purpose security deposit demand letter you can customize.
                This template does not cite state-specific statutes or deadlines — you&apos;ll
                need to research those for {stateName}.
              </p>
              <a
                href={genericLetterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <FileText className="h-4 w-4" />
                Download Template
              </a>
            </div>
          </div>
        </div>

        {/* State resources */}
        {stateResources && (
          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-base font-semibold">
              {stateName} Resources
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Official links to help you understand your rights and take action.
            </p>
            <div className="mt-4 space-y-3">
              <ResourceLink
                label="Deposit Statute"
                description={stateResources.deposit_statute}
                url={stateResources.deposit_statute_url}
              />
              <ResourceLink
                label="Small Claims Court"
                description="File a claim to recover your deposit"
                url={stateResources.small_claims_url}
              />
              <ResourceLink
                label="Free Legal Aid"
                description="Find free legal assistance in your area"
                url={stateResources.legal_aid_url}
              />
              <ResourceLink
                label="Attorney General Complaint"
                description="File a consumer protection complaint"
                url={stateResources.ag_complaint_url}
              />
            </div>
          </div>
        )}

        {/* Waitlist signup */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
          <h2 className="text-base font-semibold">
            Get Notified When {stateName} Is Supported
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We add states based on demand. Enter your email and we&apos;ll let you
            know when we launch coverage for {stateName}.
          </p>

          {waitlistStatus === 'success' ? (
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {waitlistMessage}
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="mt-4 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                type="submit"
                size="sm"
                disabled={waitlistStatus === 'loading'}
              >
                {waitlistStatus === 'loading' ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Waitlist'
                )}
              </Button>
            </form>
          )}

          {waitlistStatus === 'error' && (
            <p className="mt-2 text-sm text-destructive">{waitlistMessage}</p>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          The generic template above does not cite any specific state statute,
          does not reference state-specific deadlines, and does not include penalty
          language. It is a general-purpose starting point, not legal advice.
          Consider consulting a licensed attorney for advice specific to your situation.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Resource link sub-component                                       */
/* ------------------------------------------------------------------ */

function ResourceLink({
  label,
  description,
  url,
}: {
  label: string;
  description: string;
  url: string;
}): React.JSX.Element {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
    >
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </a>
  );
}
