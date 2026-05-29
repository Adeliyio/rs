'use client';

/**
 * useSequence — client hook for loading and managing a subscription
 * email sequence. Fetches the sequence from Supabase, tracks the
 * current step, and provides a markAsSent action.
 */

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database.types';
import type {
  GeneratedSequence,
  SequenceStep,
} from '@/types/generation.types';

/* ------------------------------------------------------------------ */
/*  Supabase browser client                                           */
/* ------------------------------------------------------------------ */

function getSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}

/* ------------------------------------------------------------------ */
/*  Return type                                                       */
/* ------------------------------------------------------------------ */

export interface UseSequenceReturn {
  sequence: GeneratedSequence | null;
  currentStep: number;
  stepSentDates: Record<number, string>;
  markAsSent: (stepNumber: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Row → domain type mapper                                          */
/* ------------------------------------------------------------------ */

interface SequenceRow {
  id: string;
  case_id: string;
  vertical: string;
  current_step: number;
  next_send_at: string | null;
  steps: Record<string, unknown>;
  grounding_context_ids: string[] | null;
  citation_validation: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function rowToSequence(row: SequenceRow): GeneratedSequence {
  // The steps column stores the GeneratedSequence shape as JSONB.
  // We extract the steps array, which was stored as { steps: [...], ... }
  const stepsData = row.steps as Record<string, unknown>;
  const stepsArray = (stepsData['steps'] as SequenceStep[]) ?? [];

  return {
    case_id: row.case_id,
    vertical: row.vertical,
    jurisdiction: (stepsData['jurisdiction'] as string) ?? '',
    steps: stepsArray,
    grounding_context_ids: row.grounding_context_ids ?? [],
    citation_validation: {
      valid: [],
      stripped: [],
      pass: true,
      ...(row.citation_validation as Record<string, unknown>),
    },
    compliance_scan_pass: true,
    created_at: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useSequence(caseId: string): UseSequenceReturn {
  const [sequence, setSequence] = useState<GeneratedSequence | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepSentDates, setStepSentDates] = useState<Record<number, string>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- Load sequence on mount ---- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const supabase = getSupabase();

        const { data, error: fetchError } = await supabase
          .from('sequences')
          .select('*')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (fetchError) {
          if (!cancelled) setError(fetchError.message);
          return;
        }

        if (!data) {
          if (!cancelled) setError('No sequence found for this case.');
          return;
        }

        const row = data as unknown as SequenceRow;
        const seq = rowToSequence(row);

        if (!cancelled) {
          setSequence(seq);
          setCurrentStep(row.current_step);

          // Extract sent dates from the steps JSONB if present
          const stepsData = row.steps as Record<string, unknown>;
          const sentDates = (stepsData['sent_dates'] as Record<string, string>) ?? {};
          const parsedDates: Record<number, string> = {};
          for (const [key, val] of Object.entries(sentDates)) {
            const num = Number(key);
            if (!Number.isNaN(num) && typeof val === 'string') {
              parsedDates[num] = val;
            }
          }
          setStepSentDates(parsedDates);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load sequence.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  /* ---- Mark step as sent ---- */
  const markAsSent = useCallback(
    async (stepNumber: number) => {
      if (!sequence) return;

      try {
        const response = await fetch(`/api/sequences/${caseId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step_number: stepNumber }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Request failed' }));
          const errorBody = body as { error?: string };
          throw new Error(errorBody.error ?? `HTTP ${response.status}`);
        }

        const result = await response.json() as {
          current_step: number;
          sent_at: string;
        };

        // Update local state optimistically
        setCurrentStep(result.current_step);
        setStepSentDates((prev) => ({
          ...prev,
          [stepNumber]: result.sent_at,
        }));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to advance step.',
        );
      }
    },
    [sequence, caseId],
  );

  return {
    sequence,
    currentStep,
    stepSentDates,
    markAsSent,
    isLoading,
    error,
  };
}
