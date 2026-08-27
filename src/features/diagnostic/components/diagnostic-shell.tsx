'use client';

/**
 * Top-level diagnostic shell — the one-question-at-a-time flow.
 *
 * Loads the graph, manages transitions between node components, and
 * renders a thin progress bar + back button. On completion it signals
 * the parent to advance the case status.
 */

import { useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Wedge } from '@/types/enums';

import { useDiagnostic } from '@/features/diagnostic/hooks/use-diagnostic';
import { NodeRenderer } from './node-renderer';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface DiagnosticShellProps {
  caseId: string;
  wedge: Wedge;
  onComplete?: () => void;
  /** Active "Unlimited" subscriber — the deposit payment node is skipped. */
  hasActiveSubscription?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                  */
/* ------------------------------------------------------------------ */

function LoadingSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6 animate-pulse">
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
    <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-500 transition-all duration-500 ease-out"
        style={{ width: `${String(pct)}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell                                                             */
/* ------------------------------------------------------------------ */

export default function DiagnosticShell({
  caseId,
  wedge,
  onComplete,
  hasActiveSubscription = false,
}: DiagnosticShellProps): React.JSX.Element {
  const {
    currentNode,
    progress,
    answer,
    goBack,
    canGoBack,
    isLoading,
    isComplete,
    error,
    state,
  } = useDiagnostic(caseId, wedge);

  /* Signal completion to parent */
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  /* Stable handler that binds the current node ID */
  const handleAnswer = useCallback(
    (value: unknown) => {
      if (!currentNode) return;
      answer(currentNode.id, value);
    },
    [currentNode, answer],
  );

  /* ---- Error state ---- */
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
        <p className="text-sm font-medium text-destructive">
          Something went wrong
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  /* ---- Loading state ---- */
  if (isLoading || !currentNode || !state) {
    return <LoadingSkeleton />;
  }

  /* ---- Completion state ---- */
  if (isComplete) {
    return (
      <div className="page-enter space-y-4">
        <ProgressBar completed={progress.estimated_total} total={progress.estimated_total} />
        <div className="rounded-lg border bg-card px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Diagnostic complete
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            We have everything we need. Generating your documents...
          </p>
        </div>
      </div>
    );
  }

  /* ---- Active diagnostic ---- */
  return (
    <div className="space-y-6">
      <ProgressBar completed={progress.completed} total={progress.estimated_total} />

      {/* Back button */}
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

      {/* Node — wrapped in a keyed container for fade animation */}
      <div key={currentNode.id} className="page-enter">
        <NodeRenderer
          node={currentNode}
          onAnswer={handleAnswer}
          state={state}
          hasActiveSubscription={hasActiveSubscription}
        />
      </div>
    </div>
  );
}
