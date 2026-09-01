'use client';

/**
 * Preview node — renders the credibility preview before the paywall.
 *
 * Fetches preview data from GET /api/cases/[id]/preview and renders
 * the LetterPreview component. On "Proceed to Payment" click, advances
 * the diagnostic to the next node (payment).
 */

import { useEffect, useState } from 'react';

import { LetterPreview } from '@/features/checkout/components/letter-preview';
import { assignPriceVariant } from '@/lib/pricing/ab-pricing';
import type { DiagnosticNode } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PreviewNodeProps {
  node: DiagnosticNode;
  onAnswer: (value: unknown) => void;
  caseId: string;
}

interface PreviewData {
  jurisdiction: string;
  jurisdiction_full_name: string;
  deposit_amount: number;
  statute_count: number;
  deadline_count: number;
  penalty_available: boolean;
  sample_statute: {
    citation: string;
    title: string;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function PreviewNodeComponent({
  node: _node,
  onAnswer,
  caseId,
}: PreviewNodeProps): React.JSX.Element {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPreview() {
      try {
        const res = await fetch(`/api/cases/${caseId}/preview`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Preview failed (${res.status})`);
        }
        const json = (await res.json()) as PreviewData;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchPreview();
    return () => { cancelled = true; };
  }, [caseId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading your letter preview...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
        <p className="text-sm text-destructive">{error ?? 'Failed to load preview data.'}</p>
      </div>
    );
  }

  const priceVariant = assignPriceVariant(caseId);

  // The preview is the credibility teaser only. "Unlock Full Letter" advances to
  // the payment node, which now presents all three plans (single / monthly /
  // annual) side by side — so the plan choice lives in one place, not split
  // across two screens.
  return (
    <LetterPreview
      jurisdiction={data.jurisdiction}
      jurisdictionFullName={data.jurisdiction_full_name}
      depositAmount={data.deposit_amount}
      statuteCount={data.statute_count}
      deadlineCount={data.deadline_count}
      penaltyAvailable={data.penalty_available}
      sampleStatuteCitation={data.sample_statute?.citation ?? 'State statute'}
      sampleStatuteTitle={data.sample_statute?.title ?? 'Security deposit law'}
      onProceedToPayment={() => onAnswer({ action: 'proceed_to_payment', price_variant: priceVariant })}
      priceLabel={priceVariant.label}
    />
  );
}
