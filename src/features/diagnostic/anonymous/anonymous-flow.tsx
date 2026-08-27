'use client';

/**
 * Anonymous value-first funnel orchestrator (SPEC.md M3).
 *
 * Owns the phase machine for a single anonymous session (answers held in React
 * memory only — no persistence, CLAUDE.md §2.5):
 *
 *   wedge picker → questions → [boundary]
 *     cancellation: POST /api/diagnostic/cancellation → sequence result (done)
 *     deposit:      POST /api/diagnostic/preview → value reveal → email capture
 *                   → account + case hydration → /case/[id] (existing paid flow)
 *
 * No account, no email, no payment upstream of the deposit email gate; the
 * cancellation wedge never gates at all.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Receipt, Shield, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Wedge } from '@/types/enums';

import {
  AnonymousDiagnosticShell,
  type AnonymousBoundary,
} from './anonymous-diagnostic-shell';
import { AnonymousCancellationResult } from './anonymous-cancellation-result';
import { AnonymousPreviewResult } from './anonymous-preview-result';
import { EmailCaptureStep } from './email-capture-step';
import {
  parseCancellationResponse,
  parsePreviewResponse,
  type CancellationResponse,
  type PreviewSupported,
} from './anonymous-schemas';
import {
  buildCancellationPayload,
  readDepositAmount,
  readDepositJurisdiction,
} from './anonymous-answers';

/* ------------------------------------------------------------------ */
/*  Phase machine                                                     */
/* ------------------------------------------------------------------ */

type Phase =
  | { kind: 'pick' }
  | { kind: 'questions'; wedge: Wedge }
  | { kind: 'generating' } // cancellation POST in flight
  | { kind: 'cancellation'; data: CancellationResponse }
  | {
      kind: 'preview';
      data: PreviewSupported;
      boundary: AnonymousBoundary;
    }
  | { kind: 'preview_unsupported'; jurisdictionName: string }
  | {
      kind: 'email';
      jurisdiction: string;
      boundary: AnonymousBoundary;
    }
  | { kind: 'error'; message: string };

interface AnonymousFlowProps {
  /** Deep-link hint from marketing CTAs (?wedge=…). */
  initialWedge?: Wedge;
}

/* ------------------------------------------------------------------ */
/*  Wedge picker                                                      */
/* ------------------------------------------------------------------ */

function WedgePicker({
  onPick,
}: {
  onPick: (wedge: Wedge) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          What can we help you recover?
        </h1>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
          Answer a few questions and see exactly what your state&apos;s law says —
          free, no account needed to start.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick('deposit')}
          className="card-interactive group flex flex-col rounded-2xl border bg-card p-7 text-left shadow-sm"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mt-4 text-[17px] font-semibold text-foreground">
            Security Deposit
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Your landlord kept your deposit — or withheld too much. See the
            statutes that protect you.
          </p>
          <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
            Start free diagnostic
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => onPick('subscription')}
          className="card-interactive group flex flex-col rounded-2xl border bg-card p-7 text-left shadow-sm"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mt-4 text-[17px] font-semibold text-foreground">
            Cancel a Subscription
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            A gym, service, or app that won&apos;t let you cancel. Get a
            ready-to-send email sequence — completely free.
          </p>
          <span className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
            Start free cancellation
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                      */
/* ------------------------------------------------------------------ */

export function AnonymousFlow({
  initialWedge,
}: AnonymousFlowProps): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    initialWedge
      ? { kind: 'questions', wedge: initialWedge }
      : { kind: 'pick' },
  );

  /* ---- Cancellation: generate the free sequence at the boundary ---- */
  const generateCancellation = useCallback(
    async (boundary: AnonymousBoundary): Promise<void> => {
      setPhase({ kind: 'generating' });
      try {
        const payload = buildCancellationPayload(boundary.state.answers);
        const res = await fetch('/api/diagnostic/cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Generation failed (${String(res.status)})`);
        }
        const data = parseCancellationResponse(await res.json());
        setPhase({ kind: 'cancellation', data });
      } catch (err) {
        setPhase({
          kind: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'We could not generate your sequence. Please try again.',
        });
      }
    },
    [],
  );

  /* ---- Deposit: compute the KB value reveal at the boundary ---- */
  const revealDeposit = useCallback(
    async (boundary: AnonymousBoundary): Promise<void> => {
      const jurisdiction = readDepositJurisdiction(boundary.state.answers);
      if (!jurisdiction) {
        setPhase({
          kind: 'error',
          message: 'We could not read your state from your answers. Please start over.',
        });
        return;
      }
      try {
        const res = await fetch('/api/diagnostic/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wedge: 'deposit',
            jurisdiction,
            deposit_amount: readDepositAmount(boundary.state.answers),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Preview failed (${String(res.status)})`);
        }
        const data = parsePreviewResponse(await res.json());
        if (!data.supported) {
          setPhase({
            kind: 'preview_unsupported',
            jurisdictionName: data.jurisdiction_full_name,
          });
          return;
        }
        setPhase({ kind: 'preview', data, boundary });
      } catch (err) {
        setPhase({
          kind: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'We could not load your result. Please try again.',
        });
      }
    },
    [],
  );

  const handleBoundary = useCallback(
    (boundary: AnonymousBoundary) => {
      // The wedge is carried on the graph the boundary came from.
      const wedge: Wedge =
        phase.kind === 'questions' ? phase.wedge : 'deposit';
      if (wedge === 'subscription') {
        void generateCancellation(boundary);
      } else {
        void revealDeposit(boundary);
      }
    },
    [phase, generateCancellation, revealDeposit],
  );

  /* ---- Render by phase ---- */
  switch (phase.kind) {
    case 'pick':
      return (
        <WedgePicker
          onPick={(wedge) => setPhase({ kind: 'questions', wedge })}
        />
      );

    case 'questions':
      return (
        <AnonymousDiagnosticShell
          wedge={phase.wedge}
          onBoundary={handleBoundary}
        />
      );

    case 'generating':
      return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Building your cancellation sequence…
          </p>
        </div>
      );

    case 'cancellation':
      return (
        <AnonymousCancellationResult
          data={phase.data}
          onStartDepositRecovery={() =>
            setPhase({ kind: 'questions', wedge: 'deposit' })
          }
        />
      );

    case 'preview':
      return (
        <AnonymousPreviewResult
          data={phase.data}
          onContinueToEmail={() =>
            setPhase({
              kind: 'email',
              jurisdiction: phase.data.jurisdiction,
              boundary: phase.boundary,
            })
          }
        />
      );

    case 'preview_unsupported':
      return (
        <div className="space-y-4 rounded-xl border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            We don&apos;t cover {phase.jurisdictionName} yet
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            We only have verified statute coverage for a few states right now.
            You can still try the subscription-cancellation tool, which works
            nationwide.
          </p>
          <Button
            variant="outline"
            onClick={() => setPhase({ kind: 'questions', wedge: 'subscription' })}
          >
            Cancel a subscription instead
          </Button>
        </div>
      );

    case 'email':
      return (
        <EmailCaptureStep
          jurisdiction={phase.jurisdiction}
          graphVersion={phase.boundary.graphVersion}
          boundaryNodeId={phase.boundary.boundaryNode.id}
          answers={phase.boundary.state.answers}
          completedNodes={phase.boundary.state.completed_nodes}
        />
      );

    case 'error':
      return (
        <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">{phase.message}</p>
          <Button variant="outline" onClick={() => router.push('/start')}>
            Start over
          </Button>
        </div>
      );

    default: {
      // Exhaustiveness guard.
      const _never: never = phase;
      return <>{String(_never)}</>;
    }
  }
}
