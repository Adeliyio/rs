/**
 * Pure state management for DiagnosticState.
 *
 * Every function returns a *new* state object — never mutates the input.
 * The state tracks answers, completed nodes, extracted fields, and the
 * current position within the diagnostic graph.
 */

import type {
  DiagnosticState,
  ExtractedField,
} from '@/types/diagnostic.types';

/* ------------------------------------------------------------------ */
/*  Factory                                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a fresh DiagnosticState positioned at the graph's entry node.
 */
export function createInitialState(
  caseId: string,
  graphVersion: string,
  entryNode: string,
): DiagnosticState {
  const now = new Date().toISOString();
  return {
    case_id: caseId,
    graph_version: graphVersion,
    current_node: entryNode,
    answers: {},
    completed_nodes: [],
    extracted_fields: {},
    is_completed: false,
    started_at: now,
    updated_at: now,
  };
}

/* ------------------------------------------------------------------ */
/*  Advance / answer                                                  */
/* ------------------------------------------------------------------ */

/**
 * Records an answer for `nodeId`, marks it as completed, and moves
 * `current_node` to `nextNodeId`.
 */
export function advanceState(
  state: DiagnosticState,
  nodeId: string,
  answer: unknown,
  nextNodeId: string,
): DiagnosticState {
  return {
    ...state,
    answers: { ...(state.answers ?? {}), [nodeId]: answer },
    completed_nodes: [...(state.completed_nodes ?? []), nodeId],
    current_node: nextNodeId,
    updated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Extracted fields                                                  */
/* ------------------------------------------------------------------ */

/**
 * Merges document-extracted fields into the state.
 */
export function setExtractedFields(
  state: DiagnosticState,
  fields: Record<string, ExtractedField>,
): DiagnosticState {
  return {
    ...state,
    extracted_fields: { ...state.extracted_fields, ...fields },
    updated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Completion                                                        */
/* ------------------------------------------------------------------ */

/**
 * Marks the diagnostic as complete.
 */
export function markComplete(state: DiagnosticState): DiagnosticState {
  return {
    ...state,
    is_completed: true,
    updated_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Answer retrieval                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns the previously recorded answer for a node, or `undefined`.
 */
export function getAnswerForNode(
  state: DiagnosticState,
  nodeId: string,
): unknown {
  return state.answers?.[nodeId];
}

/* ------------------------------------------------------------------ */
/*  Back navigation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns true if there is at least one completed node to go back to.
 */
export function canGoBack(state: DiagnosticState): boolean {
  return (state.completed_nodes?.length ?? 0) > 0;
}

/**
 * Moves back one step: sets `current_node` to the last completed node
 * and removes that node from `completed_nodes`. The answer is preserved
 * so the UI can pre-fill the field; it will be overwritten when the user
 * re-submits via advanceState().
 * Returns the original state unchanged if there is nothing to go back to.
 */
export function goBack(state: DiagnosticState): DiagnosticState {
  if (!canGoBack(state)) return state;

  const completed = [...(state.completed_nodes ?? [])];
  const previousNodeId = completed.pop()!;

  return {
    ...state,
    current_node: previousNodeId,
    completed_nodes: completed,
    updated_at: new Date().toISOString(),
  };
}
