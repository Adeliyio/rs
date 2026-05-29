'use client';

/**
 * Primary hook that orchestrates the diagnostic question-by-question flow.
 *
 * Responsibilities:
 * - Loads graph + existing state on mount
 * - Provides the current node, progress, and navigation helpers
 * - Auto-evaluates `computed` nodes without user interaction
 * - Pre-fills answers from extracted_fields for confirmation
 * - Persists state on every answer via the persistence sub-hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import type {
  DiagnosticGraph,
  DiagnosticNode,
  DiagnosticState,
} from '@/types/diagnostic.types';
import type { Wedge } from '@/types/enums';

import {
  getCurrentNode,
  getNextNodeId,
  isTerminalNode,
  getProgress,
  type DiagnosticProgress,
} from '@/features/diagnostic/engine/graph-traversal';
import {
  createInitialState,
  advanceState,
  markComplete,
  canGoBack as canGoBackFn,
  goBack as goBackFn,
} from '@/features/diagnostic/engine/state-manager';
import { evaluateComputation } from '@/features/diagnostic/engine/computations';
import { useDiagnosticPersistence } from './use-diagnostic-persistence';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface UseDiagnosticReturn {
  currentNode: DiagnosticNode | null;
  progress: DiagnosticProgress;
  answer: (nodeId: string, value: unknown) => void;
  goBack: () => void;
  canGoBack: boolean;
  isLoading: boolean;
  isComplete: boolean;
  error: string | null;
  state: DiagnosticState | null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useDiagnostic(
  caseId: string,
  wedge: Wedge,
): UseDiagnosticReturn {
  const persistence = useDiagnosticPersistence();
  const [graph, setGraph] = useState<DiagnosticGraph | null>(null);
  const [state, setState] = useState<DiagnosticState | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Guard against double-mount (React Strict Mode)
  const initRef = useRef(false);

  /* ---------------------------------------------------------------- */
  /*  Mount: load graph + existing state                              */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    void (async () => {
      const data = await persistence.load(caseId);
      if (!data) return;

      setGraph(data.graph);

      // A valid persisted state must have a current_node; an empty {} from the DB
      // (initial insert) is not usable — treat it the same as null.
      const hasValidState =
        data.state &&
        typeof data.state === 'object' &&
        'current_node' in data.state &&
        !!data.state.current_node;

      if (hasValidState && data.state) {
        setState(data.state);
        if (data.state.is_completed) {
          setIsComplete(true);
        }
      } else {
        const initial = createInitialState(
          caseId,
          data.graph.version,
          data.graph.entry_node,
        );
        setState(initial);
        persistence.save(caseId, initial);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, wedge]);

  /* ---------------------------------------------------------------- */
  /*  Auto-advance computed nodes                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!graph || !state || isComplete) return;

    const node = getCurrentNode(graph, state);
    if (!node || node.type !== 'computed') return;

    try {
      // Build a flat answer map: use field names where available, fall back to node IDs
      const flatAnswers: Record<string, unknown> = {};
      for (const [nId, val] of Object.entries(state.answers ?? {})) {
        const graphNode = graph.nodes[nId];
        const key = graphNode?.field ?? nId;
        flatAnswers[key] = val;
      }

      const result = evaluateComputation(node.computation, flatAnswers);
      const nextId = getNextNodeId(node, result);
      if (!nextId) return;

      const nextState = advanceState(state, node.id, result, nextId);
      setState(nextState);
      persistence.save(caseId, nextState);
    } catch {
      // Computation failed — leave user on this node; they can go back
    }
  }, [graph, state, isComplete, caseId, persistence]);

  /* ---------------------------------------------------------------- */
  /*  Current node                                                    */
  /* ---------------------------------------------------------------- */

  const currentNode =
    graph && state ? getCurrentNode(graph, state) ?? null : null;

  const progress =
    graph && state
      ? getProgress(graph, state)
      : { completed: 0, estimated_total: 1 };

  /* ---------------------------------------------------------------- */
  /*  Answer handler                                                  */
  /* ---------------------------------------------------------------- */

  const answer = useCallback(
    (nodeId: string, value: unknown) => {
      if (!graph || !state) return;

      const node = graph.nodes[nodeId];
      if (!node) return;

      const nextId = getNextNodeId(node, value);
      if (!nextId) {
        // Terminal — mark complete
        const completed = markComplete(
          advanceState(state, nodeId, value, state.current_node),
        );
        setState(completed);
        setIsComplete(true);
        persistence.save(caseId, completed);
        return;
      }

      const nextState = advanceState(state, nodeId, value, nextId);

      // Check if the next node is terminal (generation, delivery, tracking, terminal)
      const nextNode = graph.nodes[nextId];
      if (nextNode && isTerminalNode(nextNode)) {
        const completed = markComplete(nextState);
        setState(completed);
        setIsComplete(true);
        persistence.save(caseId, completed);
        return;
      }

      setState(nextState);
      persistence.save(caseId, nextState);
    },
    [graph, state, caseId, persistence],
  );

  /* ---------------------------------------------------------------- */
  /*  Back navigation                                                 */
  /* ---------------------------------------------------------------- */

  const goBack = useCallback(() => {
    if (!state) return;
    const prev = goBackFn(state);
    setState(prev);
    persistence.save(caseId, prev);
  }, [state, caseId, persistence]);

  const canGoBackVal = state ? canGoBackFn(state) : false;

  /* ---------------------------------------------------------------- */
  /*  Return                                                          */
  /* ---------------------------------------------------------------- */

  return {
    currentNode,
    progress,
    answer,
    goBack,
    canGoBack: canGoBackVal,
    isLoading: persistence.isLoading,
    isComplete,
    error: persistence.error,
    state,
  };
}
