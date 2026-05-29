/**
 * Pure functions for traversing a DiagnosticGraph.
 *
 * Zero side effects — every function takes data in and returns data out.
 * The graph is a Record<string, DiagnosticNode>; traversal follows
 * `next`, `branches`, or per-option `next` depending on node type.
 */

import type {
  DiagnosticGraph,
  DiagnosticNode,
  DiagnosticState,
  SelectNode,
  BooleanNode,
} from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Core traversal helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns the DiagnosticNode for the current position in the graph.
 * Returns `undefined` if the node ID is invalid (should never happen
 * in a well-formed graph).
 */
export function getCurrentNode(
  graph: DiagnosticGraph,
  state: DiagnosticState,
): DiagnosticNode | undefined {
  return graph.nodes[state.current_node];
}

/**
 * Given a node and the user's answer, resolves the next node ID.
 *
 * Resolution order:
 * 1. `branches` — boolean nodes: answer must be 'true' or 'false'
 * 2. `options`  — select nodes: find the option whose value === answer
 * 3. `next`     — linear progression (fallback for all node types)
 *
 * Returns `undefined` when no transition is defined (terminal nodes).
 */
export function getNextNodeId(
  node: DiagnosticNode,
  answer: unknown,
): string | undefined {
  // Boolean branching
  if (node.type === 'boolean') {
    const boolNode = node as BooleanNode;
    if (boolNode.branches) {
      const key = String(answer) as 'true' | 'false';
      const target = boolNode.branches[key];
      if (target) return target;
    }
  }

  // Select — per-option next
  if (node.type === 'select') {
    const selectNode = node as SelectNode;
    if (selectNode.options) {
      const matched = selectNode.options.find(
        (opt) => opt.value === String(answer),
      );
      if (matched?.next) return matched.next;
    }
  }

  // Linear next (fallback for select with no per-option next, and all other types)
  if (node.next) return node.next;

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Terminal detection                                                 */
/* ------------------------------------------------------------------ */

const TERMINAL_TYPES = new Set<string>([
  'terminal',
  'generation',
  'delivery',
  'tracking',
]);

/**
 * Returns true when the node represents a terminal point in the
 * diagnostic flow (no further user-facing questions).
 */
export function isTerminalNode(node: DiagnosticNode): boolean {
  return TERMINAL_TYPES.has(node.type);
}

/* ------------------------------------------------------------------ */
/*  Progress estimation                                               */
/* ------------------------------------------------------------------ */

export interface DiagnosticProgress {
  completed: number;
  estimated_total: number;
}

/**
 * Returns a rough progress estimate based on completed nodes vs total
 * non-terminal nodes in the graph.
 *
 * This is an estimate because the graph is a DAG with branches — the
 * user will never visit every node. We count non-terminal nodes as
 * the "total" and completed_nodes.length as "completed".
 */
export function getProgress(
  graph: DiagnosticGraph,
  state: DiagnosticState,
): DiagnosticProgress {
  const totalNonTerminal = Object.values(graph.nodes).filter(
    (n) => !TERMINAL_TYPES.has(n.type),
  ).length;

  const completedCount = state.completed_nodes?.length ?? 0;

  return {
    completed: completedCount,
    estimated_total: Math.max(totalNonTerminal, completedCount),
  };
}

/* ------------------------------------------------------------------ */
/*  Node path (for resume / back navigation)                          */
/* ------------------------------------------------------------------ */

/**
 * Returns the ordered list of completed node IDs — mirrors the path
 * the user took through the graph. Useful for resume and back-nav.
 */
export function getNodePath(
  _graph: DiagnosticGraph,
  state: DiagnosticState,
): string[] {
  return [...(state.completed_nodes ?? [])];
}
