/**
 * KB validation utilities.
 *
 * Re-exports Zod schemas from kb.types and adds cross-reference
 * and graph-structural validation functions that can be imported
 * anywhere (unlike scripts/validate-kb.ts which is CLI-only).
 */

import type { ZodError } from 'zod';
import type { DiagnosticGraph, DiagnosticNode } from '@/types/diagnostic.types';

// Re-export all Zod schemas for convenience
export {
  statuteSchema,
  keyProvisionSchema,
  deadlineRuleSchema,
  deadlinePromptConfigSchema,
  penaltySchema,
  escalationVenueSchema,
  deductionCategorySchema,
  specialProvisionSchema,
  verificationSchema,
  kbEntrySchema,
  packetTemplateSchema,
  packetFeesSchema,
  packetMediationSchema,
  verticalTemplateSchema,
  emailStepTemplateSchema,
  stateHealthClubLawSchema,
  refusalRuleSchema,
  refusalResourceTemplateSchema,
  tangledCaseRulesSchema,
  declineCopyMessageSchema,
  declineCopySchema,
  adversarialCounselTriggerSchema,
  subscriptionBaseSchema,
  disclaimerSchema,
  disclaimersFileSchema,
} from '@/types/kb.types';

import {
  kbEntrySchema,
} from '@/types/kb.types';
import type { KbEntry } from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Validation result type                                            */
/* ------------------------------------------------------------------ */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

function fail(errors: string[], warnings: string[] = []): ValidationResult {
  return { valid: false, errors, warnings };
}

function fromZodError(err: ZodError): ValidationResult {
  const errors = err.issues.map(
    (i) => `${i.path.join('.')}: ${i.message}`,
  );
  return fail(errors);
}

/* ------------------------------------------------------------------ */
/*  KB Entry validation                                               */
/* ------------------------------------------------------------------ */

/** Validate a KB entry against the Zod schema. */
export function validateKbEntry(entry: unknown): ValidationResult {
  const result = kbEntrySchema.safeParse(entry);
  if (!result.success) {
    return fromZodError(result.error);
  }
  return ok();
}

/* ------------------------------------------------------------------ */
/*  Cross-reference validation                                        */
/* ------------------------------------------------------------------ */

/**
 * Check that every statute_id referenced in deadline_rules
 * exists in the statutes[] array.
 */
export function validateStatuteCrossRefs(entry: KbEntry): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const statuteIds = new Set(
    entry.statutes.map((s) => s.statute_id ?? s.id).filter(Boolean),
  );

  for (const rule of entry.deadline_rules) {
    if (!statuteIds.has(rule.statute_id)) {
      errors.push(
        `deadline_rules: rule "${rule.rule_id}" references statute_id "${rule.statute_id}" not found in statutes[]`,
      );
    }
  }

  for (const penalty of entry.penalties) {
    if (!statuteIds.has(penalty.statute_id)) {
      errors.push(
        `penalties: penalty "${penalty.penalty_id ?? penalty.id}" references statute_id "${penalty.statute_id}" not found in statutes[]`,
      );
    }
  }

  if (errors.length > 0) {
    return fail(errors, warnings);
  }
  return { valid: true, errors: [], warnings };
}

/* ------------------------------------------------------------------ */
/*  Diagnostic graph validation                                       */
/* ------------------------------------------------------------------ */

/**
 * Get all successor node IDs from a diagnostic node.
 */
function getSuccessors(node: DiagnosticNode): string[] {
  const successors: string[] = [];

  if ('next' in node && node.next) {
    successors.push(node.next);
  }

  if (node.type === 'select' && node.options) {
    for (const opt of node.options) {
      if (opt.next) {
        successors.push(opt.next);
      }
    }
  }

  if (node.type === 'boolean' && node.branches) {
    successors.push(node.branches.true);
    successors.push(node.branches.false);
  }

  return successors;
}

/**
 * Validate a diagnostic graph for:
 * - entry_node existence
 * - all edge references resolve to existing nodes
 * - reachability (all nodes reachable from entry)
 * - cycle detection
 * - terminal coverage (every path reaches a terminal or leaf)
 */
export function validateGraph(graph: DiagnosticGraph): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(Object.keys(graph.nodes));

  // 1. Entry node exists
  if (!nodeIds.has(graph.entry_node)) {
    return fail([`entry_node "${graph.entry_node}" not found in nodes`]);
  }

  // 2. All referenced nodes exist
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    for (const s of getSuccessors(node)) {
      if (!nodeIds.has(s)) {
        errors.push(`node "${nodeId}" references non-existent node "${s}"`);
      }
    }
  }

  // 3. Reachability via BFS
  const visited = new Set<string>();
  const queue: string[] = [graph.entry_node];
  visited.add(graph.entry_node);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = graph.nodes[current];
    if (!node) continue;

    for (const s of getSuccessors(node)) {
      if (!visited.has(s) && nodeIds.has(s)) {
        visited.add(s);
        queue.push(s);
      }
    }
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      warnings.push(`node "${nodeId}" is not reachable from entry node "${graph.entry_node}"`);
    }
  }

  // 4. Cycle detection via DFS with coloring
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) {
    color.set(id, WHITE);
  }

  let hasCycle = false;

  function dfs(nodeId: string): void {
    color.set(nodeId, GRAY);
    const node = graph.nodes[nodeId];
    if (!node) {
      color.set(nodeId, BLACK);
      return;
    }

    for (const s of getSuccessors(node)) {
      if (!nodeIds.has(s)) continue;
      const c = color.get(s);
      if (c === GRAY) {
        errors.push(`cycle detected involving node "${s}"`);
        hasCycle = true;
      } else if (c === WHITE) {
        dfs(s);
      }
    }
    color.set(nodeId, BLACK);
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE) {
      dfs(id);
      if (hasCycle) break;
    }
  }

  // 5. Terminal coverage — every reachable node must be able to reach a terminal/leaf
  if (!hasCycle) {
    const isTerminal = (nodeId: string): boolean => {
      const node = graph.nodes[nodeId];
      if (!node) return false;
      if (node.type === 'terminal') return true;
      // Leaf nodes (no successors) are also endpoints
      return getSuccessors(node).length === 0;
    };

    const reachesTerminal = new Map<string, boolean>();

    function canReachTerminal(nodeId: string, pathSet: Set<string>): boolean {
      const memoized = reachesTerminal.get(nodeId);
      if (memoized !== undefined) return memoized;

      if (isTerminal(nodeId)) {
        reachesTerminal.set(nodeId, true);
        return true;
      }
      if (pathSet.has(nodeId)) {
        return false;
      }

      pathSet.add(nodeId);
      const node = graph.nodes[nodeId];
      if (!node) {
        reachesTerminal.set(nodeId, false);
        return false;
      }

      const succs = getSuccessors(node);
      if (succs.length === 0) {
        reachesTerminal.set(nodeId, true);
        return true;
      }

      let allReach = true;
      for (const s of succs) {
        if (nodeIds.has(s) && !canReachTerminal(s, new Set(pathSet))) {
          allReach = false;
        }
      }

      reachesTerminal.set(nodeId, allReach);
      return allReach;
    }

    for (const nodeId of visited) {
      if (!canReachTerminal(nodeId, new Set())) {
        errors.push(`node "${nodeId}" has a path that never reaches a terminal`);
      }
    }
  }

  const valid = errors.length === 0;
  return { valid, errors, warnings };
}
