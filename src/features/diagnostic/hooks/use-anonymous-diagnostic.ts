'use client';

/**
 * Anonymous, in-memory sibling of {@link useDiagnostic} (SPEC.md M3).
 *
 * Same graph-traversal + state-manager engine, but:
 *  - the graph is loaded from the PUBLIC GET /api/diagnostic/graph (no case, no
 *    auth) instead of the authenticated /api/diagnostic/state;
 *  - state lives in React memory ONLY — nothing is persisted (CLAUDE.md §2.5
 *    forbids localStorage/sessionStorage for stateful data; a refresh losing
 *    anonymous progress is acceptable per spec);
 *  - traversal STOPS when it reaches a "boundary" node — a node whose type marks
 *    the value/cost boundary (file_upload for deposit, generation for the free
 *    cancellation) — so the caller can take over rendering (value reveal, email
 *    capture, or cancellation result) instead of the engine hitting a node that
 *    would require a real case or a paid call.
 *
 * The node components are reused unchanged via the shared NodeRenderer.
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
  getProgress,
  type DiagnosticProgress,
} from '@/features/diagnostic/engine/graph-traversal';
import {
  createInitialState,
  advanceState,
  canGoBack as canGoBackFn,
  goBack as goBackFn,
} from '@/features/diagnostic/engine/state-manager';
import { evaluateComputation } from '@/features/diagnostic/engine/computations';
import {
  parseGraphResponse,
} from '@/features/diagnostic/anonymous/anonymous-schemas';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/**
 * The node types at which anonymous traversal halts and hands control back to
 * the caller. Deposit stops before the first authenticated/paid step
 * (file_upload → AI vision); cancellation stops before generation, which is the
 * free ($0) template call the caller triggers via POST /api/diagnostic/cancellation.
 */
const DEPOSIT_BOUNDARY_TYPES = new Set<DiagnosticNode['type']>([
  'file_upload',
  'preview',
  'payment',
  'generation',
]);
const CANCELLATION_BOUNDARY_TYPES = new Set<DiagnosticNode['type']>([
  'generation',
  'delivery',
  'tracking',
]);

function boundaryTypesFor(wedge: Wedge): Set<DiagnosticNode['type']> {
  return wedge === 'deposit'
    ? DEPOSIT_BOUNDARY_TYPES
    : CANCELLATION_BOUNDARY_TYPES;
}

/** A terminal (refusal / out-of-scope / unsupported) reached mid-flow. */
export interface AnonymousTerminal {
  node: DiagnosticNode;
}

export interface UseAnonymousDiagnosticReturn {
  currentNode: DiagnosticNode | null;
  progress: DiagnosticProgress;
  answer: (nodeId: string, value: unknown) => void;
  goBack: () => void;
  canGoBack: boolean;
  isLoading: boolean;
  error: string | null;
  state: DiagnosticState | null;
  graph: DiagnosticGraph | null;
  /** Set once traversal reaches the value/cost boundary node for this wedge. */
  boundaryNode: DiagnosticNode | null;
  /** Set if the flow hits a terminal refusal / unsupported-jurisdiction node. */
  terminal: AnonymousTerminal | null;
}

/* ------------------------------------------------------------------ */
/*  Synthetic case id                                                 */
/* ------------------------------------------------------------------ */

// state-manager stamps a case_id into the in-memory state; nothing reads it
// anonymously (no persistence), so a stable synthetic value is fine.
const ANON_CASE_ID = 'anonymous';

const TERMINAL_TYPES = new Set<DiagnosticNode['type']>([
  'terminal',
  'delivery',
  'tracking',
]);

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useAnonymousDiagnostic(
  wedge: Wedge,
): UseAnonymousDiagnosticReturn {
  const [graph, setGraph] = useState<DiagnosticGraph | null>(null);
  const [state, setState] = useState<DiagnosticState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boundaryNode, setBoundaryNode] = useState<DiagnosticNode | null>(null);
  const [terminal, setTerminal] = useState<AnonymousTerminal | null>(null);

  // Guard against React Strict Mode double-mount.
  const initRef = useRef(false);

  /* ---- Mount: load the public graph, build in-memory initial state ---- */
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/diagnostic/graph?wedge=${encodeURIComponent(wedge)}`,
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Failed to load diagnostic (${String(res.status)})`);
        }
        const { graph: loadedGraph } = parseGraphResponse(await res.json());
        // parseGraphResponse validated the envelope; the engine consumes the
        // already-typed DiagnosticGraph structure.
        const typedGraph = loadedGraph as unknown as DiagnosticGraph;
        setGraph(typedGraph);
        setState(
          createInitialState(
            ANON_CASE_ID,
            typedGraph.version,
            typedGraph.entry_node,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load diagnostic',
        );
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wedge]);

  /* ---- Detect boundary / terminal for the current node ---- */
  useEffect(() => {
    if (!graph || !state || boundaryNode || terminal) return;
    const node = getCurrentNode(graph, state);
    if (!node) return;

    if (boundaryTypesFor(wedge).has(node.type)) {
      setBoundaryNode(node);
      return;
    }
    if (node.type === 'terminal') {
      setTerminal({ node });
    }
  }, [graph, state, wedge, boundaryNode, terminal]);

  /* ---- Auto-advance computed nodes (pure, client-side) ---- */
  useEffect(() => {
    if (!graph || !state || boundaryNode || terminal) return;

    const node = getCurrentNode(graph, state);
    if (!node || node.type !== 'computed') return;

    try {
      const flatAnswers: Record<string, unknown> = {};
      for (const [nId, val] of Object.entries(state.answers ?? {})) {
        const graphNode = graph.nodes[nId];
        const key = graphNode?.field ?? nId;
        flatAnswers[key] = val;
      }

      const result = evaluateComputation(node.computation, flatAnswers);
      const nextId = getNextNodeId(node, result);
      if (!nextId) return;

      setState(advanceState(state, node.id, result, nextId));
    } catch {
      // Computation failed — leave the user on this node; they can go back.
    }
  }, [graph, state, boundaryNode, terminal]);

  /* ---- Current node ---- */
  const currentNode =
    graph && state ? getCurrentNode(graph, state) ?? null : null;

  const progress =
    graph && state
      ? getProgress(graph, state)
      : { completed: 0, estimated_total: 1 };

  /* ---- Answer handler ---- */
  const answer = useCallback(
    (nodeId: string, value: unknown) => {
      if (!graph || !state) return;

      const node = graph.nodes[nodeId];
      if (!node) return;

      const nextId = getNextNodeId(node, value);
      if (!nextId) {
        // No transition defined — treat as a mid-flow terminal.
        setTerminal({ node });
        return;
      }

      const nextState = advanceState(state, nodeId, value, nextId);
      const nextNode = graph.nodes[nextId];

      // If the next node is the value/cost boundary, advance state to it and let
      // the boundary-detection effect surface it.
      if (nextNode && boundaryTypesFor(wedge).has(nextNode.type)) {
        setState(nextState);
        return;
      }

      // If the next node is a terminal refusal, advance and surface it.
      if (nextNode && TERMINAL_TYPES.has(nextNode.type)) {
        setState(nextState);
        return;
      }

      setState(nextState);
    },
    [graph, state, wedge],
  );

  /* ---- Back navigation ---- */
  const goBack = useCallback(() => {
    if (!state) return;
    // Leaving a boundary/terminal re-enters the interactive flow.
    setBoundaryNode(null);
    setTerminal(null);
    setState(goBackFn(state));
  }, [state]);

  const canGoBackVal = state ? canGoBackFn(state) : false;

  return {
    currentNode,
    progress,
    answer,
    goBack,
    canGoBack: canGoBackVal,
    isLoading,
    error,
    state,
    graph,
    boundaryNode,
    terminal,
  };
}
