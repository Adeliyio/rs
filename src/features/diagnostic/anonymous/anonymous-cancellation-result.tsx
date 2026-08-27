'use client';

/**
 * Anonymous cancellation result (SPEC.md M3) — the fully-anonymous free wedge
 * deliverable: the deterministic 3-step email sequence rendered in-browser with
 * copy + download, NO account, NO email, NO payment.
 *
 * Data is the zod-parsed POST /api/diagnostic/cancellation response, fetched by
 * the orchestrator and passed in. Legal-safety disclaimer (SPEC.md §4) is
 * persistent on-screen. A contextual cross-sell to deposit recovery sits at the
 * bottom per the spec's cancellation results screen.
 */

import { useCallback, useState } from 'react';
import { Check, Copy, Download, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { CancellationResponse } from './anonymous-schemas';
import { AnonymousDisclaimer } from './anonymous-disclaimer';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface AnonymousCancellationResultProps {
  data: CancellationResponse;
  /** Cross-sell: routes the visitor into the anonymous deposit diagnostic. */
  onStartDepositRecovery: () => void;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Email 1 — Cancellation Request',
  2: 'Email 2 — Follow-Up',
  3: 'Email 3 — Final Notice',
};

/* ------------------------------------------------------------------ */
/*  Plain-text export                                                 */
/* ------------------------------------------------------------------ */

function sequenceToText(data: CancellationResponse): string {
  const lines: string[] = [];
  lines.push('YOUR SUBSCRIPTION CANCELLATION EMAIL SEQUENCE');
  lines.push('');
  lines.push(
    'Send these three emails one at a time. Only move to the next if you do not',
  );
  lines.push('receive a satisfactory response.');
  lines.push('');
  lines.push(
    'Resolvaio provides legal information grounded in verified statutes — not',
  );
  lines.push('legal advice. We are not a law firm and not your attorney.');
  lines.push('');
  lines.push('='.repeat(60));

  for (const step of data.steps) {
    lines.push('');
    lines.push(STEP_LABELS[step.step_number] ?? `Email ${step.step_number}`);
    lines.push(`When to send: ${step.timing_description}`);
    lines.push('');
    lines.push(`Subject: ${step.subject}`);
    lines.push('');
    lines.push(step.body);
    if (step.citations.length > 0) {
      lines.push('');
      lines.push(`Cited: ${step.citations.join(', ')}`);
    }
    lines.push('');
    lines.push('='.repeat(60));
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Single step card                                                  */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
}: {
  step: CancellationResponse['steps'][number];
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = `Subject: ${step.subject}\n\n${step.body}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [step]);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {STEP_LABELS[step.step_number] ?? `Email ${step.step_number}`}
          </p>
          <p className="text-xs text-muted-foreground">{step.timing_description}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </Button>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Subject
          </span>
          <p className="mt-1 text-sm font-medium text-foreground">{step.subject}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Body
          </span>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {step.body}
          </pre>
        </div>
        {step.citations.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-accent/70 px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider text-primary">
              Grounded in
            </span>
            <p className="mt-0.5 text-xs text-accent-foreground">
              {step.citations.join(' · ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AnonymousCancellationResult({
  data,
  onStartDepositRecovery,
}: AnonymousCancellationResultProps): React.JSX.Element {
  const handleDownload = useCallback(() => {
    const blob = new Blob([sequenceToText(data)], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cancellation-email-sequence.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
          Your cancellation sequence is ready
        </h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
          Three emails, each building on the last. Send them one at a time — only
          move to the next if you do not get a satisfactory response. No account
          needed; copy or download them below.
        </p>
      </div>

      <AnonymousDisclaimer />

      <div className="flex justify-end">
        <Button size="sm" onClick={handleDownload} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download all (.txt)
        </Button>
      </div>

      <div className="space-y-4">
        {data.steps.map((step) => (
          <StepCard key={step.step_number} step={step} />
        ))}
      </div>

      {/* Contextual cross-sell to deposit recovery (SPEC.md M3). */}
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4',
          'sm:flex-row sm:items-center sm:justify-between',
        )}
      >
        <div>
          <p className="text-sm font-semibold text-foreground">
            Also owed a security deposit?
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            If a landlord kept your deposit, we can show you exactly what your
            state&apos;s law requires — free to check.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={onStartDepositRecovery}
          className="shrink-0 gap-1.5"
        >
          Check my deposit
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
