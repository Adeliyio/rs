'use client';

/**
 * Empty state — shown when the user has no cases (and the /new "New Case" entry).
 * Displays two wedge tiles (deposit, subscription) to start a new case.
 *
 * On tile click: calls POST /api/cases WITHOUT a jurisdiction and redirects to
 * /case/[id]. The state is collected by the diagnostic's first question (so it
 * is asked exactly once — no modal, no double-ask). Unsupported states are
 * handled inside the deposit graph itself (its OTHER → unsupported flow).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Receipt, Shield } from 'lucide-react';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  /** Deep-link hint from marketing CTAs (?wedge=…): starts that wedge directly. */
  preselectWedge?: 'deposit' | 'subscription';
}

export function EmptyState({ preselectWedge }: EmptyStateProps = {}): React.JSX.Element {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createCase = useCallback(
    async (wedge: string) => {
      setIsCreating(wedge);
      setError(null);

      try {
        // No jurisdiction sent — the diagnostic collects the state as its first
        // question. The API creates the case with a PENDING jurisdiction.
        const response = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wedge }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({ error: 'Request failed' }))) as {
            error?: string;
            code?: string;
            existing_case_id?: string;
          };

          // Duplicate active case — redirect to the existing one
          if (data.code === 'DUPLICATE_ACTIVE_CASE' && data.existing_case_id) {
            router.push(`/case/${data.existing_case_id}`);
            return;
          }

          throw new Error(data.error ?? `HTTP ${response.status}`);
        }

        const data = (await response.json()) as { id: string };
        router.push(`/case/${data.id}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to create case',
        );
        setIsCreating(null);
      }
    },
    [router],
  );

  // No state modal: the diagnostic asks for the state as its first question, so
  // clicking a wedge creates the case immediately (state omitted → PENDING, set
  // by the diagnostic). This removes the old double-ask (modal state → diagnostic
  // re-asked the same state).
  const handleDepositClick = useCallback(() => {
    void createCase('deposit');
  }, [createCase]);

  const handleSubscriptionClick = useCallback(() => {
    void createCase('subscription');
  }, [createCase]);

  // Deep-link (?wedge=deposit|subscription from a marketing CTA): start that
  // wedge directly, once. The diagnostic still collects the state as its first
  // question. Guarded so it fires a single time even under StrictMode remounts.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    if (preselectWedge === 'deposit' || preselectWedge === 'subscription') {
      autoStarted.current = true;
      void createCase(preselectWedge);
    }
  }, [preselectWedge, createCase]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl text-center">
        <h1 className="font-display text-[34px] font-semibold tracking-tight text-foreground sm:text-[42px]">
          Recover what&apos;s yours
        </h1>
        <p className="mt-4 text-[15px] leading-[1.7] text-muted-foreground">
          Choose what you need help with. We&apos;ll walk you through every step —
          from the first letter to filing if needed.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="mt-10 grid w-full max-w-2xl gap-6 sm:grid-cols-2">
        {/* Deposit tile */}
        <button
          type="button"
          onClick={handleDepositClick}
          disabled={isCreating !== null}
          className={cn(
            'card-interactive group relative flex flex-col rounded-2xl border bg-card p-8 text-left shadow-premium',
            isCreating === 'deposit' && 'pointer-events-none opacity-70',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mt-5 font-display text-[20px] font-semibold text-foreground">Security Deposit</h2>
          <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
            Your landlord didn&apos;t return your deposit — or withheld too
            much. We generate a demand letter grounded in your state&apos;s
            statute.
          </p>
          <div className="mt-5 flex items-center gap-2 text-[14px] font-medium text-primary">
            {isCreating === 'deposit' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Start recovery
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {['CA', 'TX', 'NY', 'FL'].map((state) => (
              <span
                key={state}
                className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground"
              >
                {state}
              </span>
            ))}
          </div>
        </button>

        {/* Subscription tile — uses primary blue, not emerald */}
        <button
          type="button"
          onClick={handleSubscriptionClick}
          disabled={isCreating !== null}
          className={cn(
            'card-interactive group relative flex flex-col rounded-2xl border bg-card p-8 text-left shadow-premium',
            isCreating === 'subscription' && 'pointer-events-none opacity-70',
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mt-5 font-display text-[20px] font-semibold text-foreground">Cancel a Subscription</h2>
          <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
            A gym, service, or app that won&apos;t cancel. We generate a
            step-by-step email sequence using the rules that protect you.
          </p>
          <div className="mt-5 flex items-center gap-2 text-[14px] font-medium text-primary">
            {isCreating === 'subscription' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Start cancellation
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </div>
          <div className="mt-4">
            <span className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">
              Near-national coverage
            </span>
          </div>
        </button>
      </div>

      {/* Disclaimer — PRD Principle 5 */}
      <p className="mt-12 max-w-lg text-center text-[12px] text-muted-foreground leading-relaxed">
        Resolvaio is a writing and research assistance tool. It is not a law
        firm, does not provide legal advice, and does not guarantee outcomes.
        Consider consulting a licensed attorney for advice specific to your
        situation.
      </p>
    </div>
  );
}
