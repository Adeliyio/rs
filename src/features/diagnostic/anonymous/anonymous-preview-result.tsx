'use client';

/**
 * Anonymous deposit value reveal (SPEC.md M3) — the full diagnostic result shown
 * BEFORE any account: applicable statutes, deadline rules, whether a penalty may
 * apply, and what Resolvaio can prepare. Rendered from the zod-parsed
 * POST /api/diagnostic/preview response.
 *
 * Legal-safety (SPEC.md §4): every line is framed as INFORMATION ("[State] law
 * requires…"), never advice; the persistent disclaimer is always visible. The
 * "we can prepare a demand letter" line describes the deliverable, not a
 * prediction of outcome.
 *
 * The primary CTA opens the email-capture step ("Where should we send your
 * case?") — the one gate, placed immediately before any upload / AI-vision call.
 */

import { Scale, FileText, Shield, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PreviewSupported } from './anonymous-schemas';
import { AnonymousDisclaimer } from './anonymous-disclaimer';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface AnonymousPreviewResultProps {
  data: PreviewSupported;
  onContinueToEmail: () => void;
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AnonymousPreviewResult({
  data,
  onContinueToEmail,
}: AnonymousPreviewResultProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
          Here&apos;s what {data.jurisdiction_full_name} law says
        </h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
          Based on your answers, we found the verified statutes that govern your
          security deposit in {data.jurisdiction_full_name}. This is legal
          information from your state&apos;s law — read it before deciding what to
          do next.
        </p>
      </div>

      <AnonymousDisclaimer />

      {/* Deterministic KB findings */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Scale className="h-5 w-5" />}
          value={String(data.statute_count)}
          label={`${data.jurisdiction_full_name} statutes apply`}
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          value={String(data.deadline_count)}
          label="Deadline rules found"
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          value={data.penalty_available ? 'Yes' : 'No'}
          label="Statutory penalty may apply"
        />
      </div>

      {/* Sample statute — one grounded citation, framed as information */}
      {data.sample_statute && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Sample statute (1 of {data.statute_count})
          </p>
          <p className="mt-1.5 text-sm font-medium text-blue-950">
            {data.sample_statute.citation} — {data.sample_statute.title}
          </p>
          <p className="mt-1 text-xs text-blue-900/80">
            {data.jurisdiction_full_name} law sets specific rules and timelines
            for returning a security deposit. Your full case references every
            applicable statute.
          </p>
        </div>
      )}

      {/* What we can prepare — describes the deliverable, not an outcome */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">
          What we can prepare for you
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            A demand letter citing all {data.statute_count} applicable{' '}
            {data.jurisdiction_full_name} statutes
            {data.deposit_amount != null && (
              <> for your ${data.deposit_amount.toLocaleString()} deposit</>
            )}
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            The deadline math for your situation, based on the rules above
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            An itemized rebuttal of any deductions your landlord claimed
          </li>
        </ul>
      </div>

      {/* The one gate: email capture, before any upload / AI-vision call */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
        <p className="text-base font-semibold text-foreground">
          Where should we send your case?
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Enter your email to save this case and continue — upload your documents
          and we&apos;ll prepare your demand letter.
        </p>
        <Button onClick={onContinueToEmail} className="mt-4 gap-1.5">
          Continue to my case
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
