'use client';

/**
 * Summary node — pre-generation review of all answered questions.
 *
 * Displays every answer in the state, requires a disclaimer acknowledgment
 * checkbox (loaded from KB compliance/disclaimers.json via API), and
 * provides a "Generate" button that is disabled until the checkbox is checked.
 */

import { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SummaryNode, DiagnosticState } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface SummaryNodeProps {
  node: SummaryNode;
  onAnswer: (value: unknown) => void;
  state: DiagnosticState;
}

/* ------------------------------------------------------------------ */
/*  Disclaimer type (partial — just what we need)                     */
/* ------------------------------------------------------------------ */

interface DisclaimerEntry {
  id: string;
  text?: string;
  body_text?: string;
  must_be_checked_to_proceed?: boolean;
}

interface DisclaimersResponse {
  disclaimers: Record<string, DisclaimerEntry>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    // Group answers — flatten to key: value pairs
    const entries = Object.entries(val as Record<string, unknown>);
    return entries
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .join(', ');
  }
  return String(val);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function SummaryNodeComponent({
  node,
  onAnswer,
  state,
}: SummaryNodeProps): React.JSX.Element {
  const [acknowledged, setAcknowledged] = useState(false);
  const [disclaimerText, setDisclaimerText] = useState<string | null>(null);
  const [loadingDisclaimer, setLoadingDisclaimer] = useState(true);

  const requiresDisclaimer = node.disclaimer_required !== false;

  /* Load disclaimer from KB via API */
  useEffect(() => {
    if (!requiresDisclaimer) {
      setLoadingDisclaimer(false);
      return;
    }

    void fetch('/api/diagnostic/state?disclaimers=true')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load disclaimers');
        return res.json() as Promise<DisclaimersResponse>;
      })
      .then((data) => {
        const entry = data.disclaimers['pre_generation_acknowledgment'];
        if (entry) {
          setDisclaimerText(entry.text ?? entry.body_text ?? null);
        }
      })
      .catch(() => {
        // Fallback disclaimer
        setDisclaimerText(
          'I understand that this tool provides writing assistance and general information. It does not provide legal advice, does not evaluate whether I have a valid claim, and does not guarantee any outcome.',
        );
      })
      .finally(() => setLoadingDisclaimer(false));
  }, [requiresDisclaimer]);

  /* Collect answered entries */
  const answeredEntries = Object.entries(state.answers ?? {}).filter(
    ([, val]) => val !== undefined && val !== 'acknowledged',
  );

  return (
    <div className="space-y-5">
      {(node.label ?? node.question) && (
        <h3 className="text-base font-medium text-foreground">
          {node.label ?? node.question ?? 'Review your information'}
        </h3>
      )}

      {/* Answer list */}
      <div className="rounded-lg border bg-card divide-y">
        {answeredEntries.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No answers recorded yet.
          </p>
        )}
        {answeredEntries.map(([nodeId, value]) => (
          <div key={nodeId} className="flex justify-between gap-4 px-4 py-2.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
              {nodeId.replace(/_/g, ' ')}
            </span>
            <span className="text-sm text-foreground text-right">
              {formatValue(value)}
            </span>
          </div>
        ))}
      </div>

      {/* Disclaimer acknowledgment */}
      {requiresDisclaimer && !loadingDisclaimer && disclaimerText && (
        <label
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3.5 cursor-pointer transition-colors',
            acknowledged ? 'border-primary bg-accent/30' : 'bg-card',
          )}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-muted-foreground/40 text-primary focus:ring-ring shrink-0"
          />
          <span className="text-sm text-muted-foreground leading-relaxed">
            {disclaimerText}
          </span>
        </label>
      )}

      {/* Generate button */}
      <Button
        size="sm"
        onClick={() => onAnswer('confirmed')}
        disabled={requiresDisclaimer && !acknowledged}
        className={cn(
          'gap-1.5 bg-accent text-accent-foreground border border-primary/20 hover:bg-accent/80 shadow-none',
          requiresDisclaimer && !acknowledged && 'opacity-50 cursor-not-allowed',
        )}
      >
        Generate
      </Button>
    </div>
  );
}
