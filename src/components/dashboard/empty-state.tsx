'use client';

/**
 * Empty state — shown when the user has no cases.
 * Displays two wedge tiles (deposit, subscription) to start a new case.
 * PRD §6.2 step 1: "Wedge identification (two tiles, or pre-selected by entry route)."
 *
 * On tile click: calls POST /api/cases to create a case, then redirects
 * to /case/[id] to begin the diagnostic.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Receipt, Shield } from 'lucide-react';

import { cn } from '@/lib/utils';
import { UnsupportedJurisdictionScreen } from '@/components/dashboard/unsupported-jurisdiction-screen';
import { STATE_RESOURCES } from '@/lib/kb/state-resources';

/* ------------------------------------------------------------------ */
/*  Jurisdiction picker for deposit wedge                             */
/* ------------------------------------------------------------------ */

const DEPOSIT_JURISDICTIONS = ['CA', 'TX', 'NY', 'FL'] as const;

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  /** Deep-link hint from marketing CTAs (?wedge=…): pre-opens the matching state picker. */
  preselectWedge?: 'deposit' | 'subscription';
}

export function EmptyState({ preselectWedge }: EmptyStateProps = {}): React.JSX.Element {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJurisdictionPicker, setShowJurisdictionPicker] = useState(
    preselectWedge === 'deposit',
  );
  const [showSubscriptionStatePicker, setShowSubscriptionStatePicker] = useState(
    preselectWedge === 'subscription',
  );
  const [unsupportedState, setUnsupportedState] = useState<string | null>(null);

  const createCase = useCallback(
    async (wedge: string, jurisdiction: string) => {
      setIsCreating(wedge);
      setError(null);

      try {
        const response = await fetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wedge, jurisdiction }),
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

  const handleDepositClick = useCallback(() => {
    setShowJurisdictionPicker(true);
    setError(null);
  }, []);

  const handleJurisdictionSelect = useCallback(
    (jurisdiction: string) => {
      void createCase('deposit', jurisdiction);
    },
    [createCase],
  );

  const handleSubscriptionClick = useCallback(() => {
    setShowSubscriptionStatePicker(true);
    setError(null);
  }, []);

  const handleSubscriptionStateSelect = useCallback(
    (state: string) => {
      void createCase('subscription', state);
    },
    [createCase],
  );

  const handleMyStateNotListed = useCallback(() => {
    setShowJurisdictionPicker(false);
    setUnsupportedState('select');
  }, []);

  const handleUnsupportedStateSelect = useCallback((selectedState: string) => {
    setUnsupportedState(selectedState);
  }, []);

  const handleBackFromUnsupported = useCallback(() => {
    setUnsupportedState(null);
  }, []);

  /* ---- Unsupported-jurisdiction full screen ---- */
  if (unsupportedState && unsupportedState !== 'select') {
    const resources = STATE_RESOURCES[unsupportedState] ?? null;

    return (
      <UnsupportedJurisdictionScreen
        state={unsupportedState}
        stateResources={resources}
        genericLetterUrl="/api/kb/generic-demand-letter"
        onBack={handleBackFromUnsupported}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="max-w-xl text-center">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground sm:text-[40px]">
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

      <div className="mt-12 grid w-full max-w-2xl gap-6 sm:grid-cols-2">
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
          <h2 className="mt-5 text-[18px] font-semibold text-foreground">Security Deposit</h2>
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
            {DEPOSIT_JURISDICTIONS.map((state) => (
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
          <h2 className="mt-5 text-[18px] font-semibold text-foreground">Cancel a Subscription</h2>
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

      {/* Jurisdiction picker modal for deposit */}
      {showJurisdictionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border bg-card p-8 shadow-premium-lg">
            <h3 className="text-[18px] font-semibold text-foreground">Select your state</h3>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Security deposit recovery is currently available in these states.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {DEPOSIT_JURISDICTIONS.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => handleJurisdictionSelect(state)}
                  disabled={isCreating !== null}
                  className={cn(
                    'flex items-center justify-center rounded-xl border px-4 py-3.5',
                    'text-[14px] font-medium transition-all',
                    'hover:bg-accent hover:border-primary/20',
                    isCreating !== null && 'pointer-events-none opacity-70',
                  )}
                >
                  {state}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleMyStateNotListed}
              className="mt-4 w-full text-[14px] font-medium text-primary transition-colors hover:text-primary/80"
            >
              My state isn&apos;t listed
            </button>

            <button
              type="button"
              onClick={() => setShowJurisdictionPicker(false)}
              className="mt-3 w-full rounded-xl border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* State picker modal for subscription */}
      {showSubscriptionStatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border bg-card p-8 shadow-premium-lg">
            <h3 className="text-[18px] font-semibold text-foreground">Select your state</h3>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Subscription cancellation is available in all US states.
            </p>

            <div className="mt-6 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
              {US_STATES.map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => handleSubscriptionStateSelect(state)}
                  disabled={isCreating !== null}
                  className={cn(
                    'flex items-center justify-center rounded-lg border px-3 py-2.5',
                    'text-[13px] font-medium transition-all',
                    'hover:bg-accent hover:border-primary/20',
                    isCreating !== null && 'pointer-events-none opacity-70',
                  )}
                >
                  {state}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowSubscriptionStatePicker(false)}
              className="mt-5 w-full rounded-xl border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Unsupported state picker — choose which unsupported state */}
      {unsupportedState === 'select' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border bg-card p-8 shadow-premium-lg">
            <h3 className="text-[18px] font-semibold text-foreground">Select your state</h3>
            <p className="mt-2 text-[14px] text-muted-foreground">
              We&apos;ll show you free resources and a generic demand letter template
              for your state.
            </p>

            <div className="mt-6 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
              {US_STATES.filter(
                (s) => !(DEPOSIT_JURISDICTIONS as readonly string[]).includes(s),
              ).map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => handleUnsupportedStateSelect(state)}
                  className={cn(
                    'flex items-center justify-center rounded-lg border px-3 py-2.5',
                    'text-[13px] font-medium transition-all',
                    'hover:bg-accent hover:border-primary/20',
                  )}
                >
                  {state}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleBackFromUnsupported}
              className="mt-5 w-full rounded-xl border px-4 py-2.5 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Disclaimer — PRD Principle 5 */}
      <p className="mt-12 max-w-lg text-center text-[12px] text-muted-foreground/70 leading-relaxed">
        Resolvaio is a writing and research assistance tool. It is not a law
        firm, does not provide legal advice, and does not guarantee outcomes.
        Consider consulting a licensed attorney for advice specific to your
        situation.
      </p>
    </div>
  );
}
