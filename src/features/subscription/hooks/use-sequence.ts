'use client';

/**
 * useSequence — client hook for loading and managing a subscription
 * email sequence. Fetches the sequence from Supabase, tracks the
 * current step, and provides a markAsSent action.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'convex/react';

import { api } from '@convex/api';
import type { Id } from '@convex/dataModel';
import type {
  GeneratedSequence,
  SequenceStep,
} from '@/types/generation.types';

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
  const [error, setError] = useState<string | null>(null);

  // Reactive Convex query — ownership enforced in latestByCaseMine.
  const row = useQuery(api.sequences.latestByCaseMine, {
    caseId: caseId as Id<'cases'>,
  }) as SequenceRow | null | undefined;

  const isLoading = row === undefined;

  /* ---- Derive state when the query resolves ---- */
  useEffect(() => {
    if (row === undefined) return; // still loading
    if (row === null) {
      setError('No sequence found for this case.');
      return;
    }
    setError(null);
    setSequence(rowToSequence(row));
    setCurrentStep(row.current_step);

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
  }, [row]);

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
          const body: unknown = await response
            .json()
            .catch(() => ({ error: 'Request failed' }));
          const errorBody = (body ?? {}) as { error?: string };
          throw new Error(errorBody.error ?? `HTTP ${response.status}`);
        }

        // The reactive Convex query (latestByCaseMine) will refresh
        // currentStep + sent dates automatically. Apply a light optimistic
        // update so the UI responds immediately.
        setStepSentDates((prev) => ({
          ...prev,
          [stepNumber]: new Date().toISOString(),
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
