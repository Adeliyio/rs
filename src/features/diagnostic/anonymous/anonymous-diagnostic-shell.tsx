'use client';

/**
 * Anonymous diagnostic shell (SPEC.md M3) — the public, no-account question flow.
 *
 * Mirrors the authenticated DiagnosticShell (progress bar, back button, one node
 * at a time) but drives {@link useAnonymousDiagnostic} and reuses the shared
 * {@link NodeRenderer} node components. When traversal reaches the wedge's
 * value/cost boundary it calls `onBoundary` with the collected answers so the
 * orchestrator can render the value reveal (deposit) or generate the sequence
 * (cancellation). Terminal refusals render the shared DeclineScreen.
 */

import { useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Wedge } from '@/types/enums';
import type { DiagnosticNode, DiagnosticState } from '@/types/diagnostic.types';

import { useAnonymousDiagnostic } from '@/features/diagnostic/hooks/use-anonymous-diagnostic';
import { NodeRenderer } from '@/features/diagnostic/components/node-renderer';
import DeclineScreen from '@/features/diagnostic/components/decline-screen';
import { UnsupportedJurisdictionScreen } from '@/components/dashboard/unsupported-jurisdiction-screen';
import { STATE_RESOURCES } from '@/lib/kb/state-resources';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface AnonymousBoundary {
  boundaryNode: DiagnosticNode;
  state: DiagnosticState;
  graphVersion: string;
}

interface AnonymousDiagnosticShellProps {
  wedge: Wedge;
  /** Fired once when traversal reaches the value/cost boundary node. */
  onBoundary: (boundary: AnonymousBoundary) => void;
}

/* ------------------------------------------------------------------ */
/*  Progress bar                                                      */
/* ------------------------------------------------------------------ */

function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}): React.JSX.Element {
  const pct = total > 0 ? Math.min((completed / total) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${String(pct)}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                  */
/* ------------------------------------------------------------------ */

function LoadingSkeleton(): React.JSX.Element {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-1.5 w-full rounded-full bg-border" />
      <div className="space-y-4 pt-4">
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="mt-6 space-y-3">
          <div className="h-12 w-full rounded-lg bg-muted" />
          <div className="h-12 w-full rounded-lg bg-muted" />
          <div className="h-12 w-full rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell                                                             */
/* ------------------------------------------------------------------ */

export function AnonymousDiagnosticShell({
  wedge,
  onBoundary,
}: AnonymousDiagnosticShellProps): React.JSX.Element {
  const {
    currentNode,
    progress,
    answer,
    goBack,
    canGoBack,
    isLoading,
    error,
    state,
    graph,
    boundaryNode,
    terminal,
  } = useAnonymousDiagnostic(wedge);

  /* Surface the boundary to the orchestrator exactly once. */
  useEffect(() => {
    if (boundaryNode && state && graph) {
      onBoundary({
        boundaryNode,
        state,
        graphVersion: graph.version,
      });
    }
    // onBoundary is a stable callback from the parent; boundaryNode fires once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryNode]);

  const handleAnswer = useCallback(
    (value: unknown) => {
      if (!currentNode) return;
      answer(currentNode.id, value);
    },
    [currentNode, answer],
  );

  /* ---- Error ---- */
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  /* ---- Terminal: unsupported jurisdiction ---- */
  // This is NOT a refusal — the visitor did everything right, we just don't
  // cover their state yet. Show the "Coming Soon" screen with a free generic
  // template, that state's official resources, and a waitlist — not the
  // compassionate-decline screen (which also has no copy for this case).
  if (
    terminal &&
    terminal.node.type === 'terminal' &&
    terminal.node.terminal_type === 'unsupported_jurisdiction'
  ) {
    const stateCode =
      typeof state?.answers['jurisdiction_state_other'] === 'string'
        ? (state.answers['jurisdiction_state_other'] as string)
        : '';
    return (
      <UnsupportedJurisdictionScreen
        state={stateCode}
        stateResources={STATE_RESOURCES[stateCode] ?? null}
        genericLetterUrl="/api/kb/generic-demand-letter"
        onBack={goBack}
      />
    );
  }

  /* ---- Terminal refusal (out-of-scope cases) ---- */
  if (terminal) {
    const node = terminal.node;
    const ruleId =
      node.type === 'terminal'
        ? node.refusal_rule ?? node.terminal_type
        : 'out_of_scope';
    return <DeclineScreen ruleId={ruleId} />;
  }

  /* ---- Boundary reached — orchestrator takes over; hold a calm placeholder. */
  if (boundaryNode) {
    return (
      <div className="flex items-center gap-2 py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Preparing your result…</p>
      </div>
    );
  }

  /* ---- Loading ---- */
  if (isLoading || !currentNode || !state) {
    return <LoadingSkeleton />;
  }

  /* ---- Active diagnostic ---- */
  return (
    <div className="space-y-6">
      <ProgressBar completed={progress.completed} total={progress.estimated_total} />

      {canGoBack && (
        <button
          type="button"
          onClick={goBack}
          className={cn(
            'flex items-center gap-1.5 text-sm text-muted-foreground',
            'transition-colors hover:text-foreground',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      )}

      <div key={currentNode.id} className="page-enter">
        <NodeRenderer node={currentNode} onAnswer={handleAnswer} state={state} />
      </div>
    </div>
  );
}
