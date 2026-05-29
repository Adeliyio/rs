'use client';

/**
 * Sub-hook for persisting DiagnosticState to/from the server.
 *
 * - loadState  → GET  /api/diagnostic/state?caseId=X
 * - saveState  → PUT  /api/diagnostic/state  (debounced 500ms)
 *
 * The server returns both the graph and the state so the client
 * never needs filesystem access.
 */

import { useState, useRef, useCallback } from 'react';

import type { DiagnosticGraph, DiagnosticState } from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DiagnosticPayload {
  graph: DiagnosticGraph;
  state: DiagnosticState | null;
}

export interface UseDiagnosticPersistenceReturn {
  payload: DiagnosticPayload | null;
  isLoading: boolean;
  error: string | null;
  load: (caseId: string) => Promise<DiagnosticPayload | null>;
  save: (caseId: string, state: DiagnosticState) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useDiagnosticPersistence(): UseDiagnosticPersistenceReturn {
  const [payload, setPayload] = useState<DiagnosticPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track latest pending state to avoid stale closures
  const pendingStateRef = useRef<DiagnosticState | null>(null);

  /* ---- load ---- */
  const load = useCallback(async (caseId: string): Promise<DiagnosticPayload | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/diagnostic/state?caseId=${encodeURIComponent(caseId)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          typeof body.error === 'string' ? body.error : `HTTP ${String(res.status)}`,
        );
      }
      const data = (await res.json()) as DiagnosticPayload;
      setPayload(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load diagnostic';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ---- save (debounced) ---- */
  const save = useCallback((caseId: string, state: DiagnosticState) => {
    pendingStateRef.current = state;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const stateToSave = pendingStateRef.current;
      if (!stateToSave) return;
      pendingStateRef.current = null;

      void fetch('/api/diagnostic/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, state: stateToSave }),
      }).catch(() => {
        // Silently drop save errors — will retry on next answer
      });
    }, 500);
  }, []);

  return { payload, isLoading, error, load, save };
}
