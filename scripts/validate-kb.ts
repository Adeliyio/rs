import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { checkAllJurisdictions } from '../src/lib/seo/kb-consistency';

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');
const KB_DIR = join(ROOT, 'kb');

let errors = 0;
let warnings = 0;

function error(msg: string): void {
  console.error(`ERROR: ${msg}`);
  errors++;
}

function warn(msg: string): void {
  console.error(`WARNING: ${msg}`);
  warnings++;
}

function info(msg: string): void {
  console.log(`INFO: ${msg}`);
}

function readJson(filePath: string): unknown {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    error(`Failed to parse JSON: ${relative(ROOT, filePath)} - ${message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Validate kb-entry.json files
// ---------------------------------------------------------------------------

function findKbEntries(): string[] {
  const entries: string[] = [];
  const wedges = ['deposit', 'subscription'];

  for (const wedge of wedges) {
    const wedgeDir = join(KB_DIR, wedge);
    if (!existsSync(wedgeDir)) continue;

    for (const item of readdirSync(wedgeDir)) {
      // Skip files that start with _ (like _deposit-base.json)
      if (item.startsWith('_')) continue;

      const itemDir = join(wedgeDir, item);
      if (!statSync(itemDir).isDirectory()) continue;

      const entryFile = join(itemDir, 'kb-entry.json');
      if (existsSync(entryFile)) {
        entries.push(entryFile);
      }
    }
  }

  return entries;
}

interface KbStatute {
  statute_id?: string;
}

interface KbDeadlineRule {
  statute_id?: string;
}

interface KbRebuttalEntry {
  statute_id?: string;
}

interface KbVerification {
  last_verified?: string;
  verified_by?: string;
}

interface KbEntry {
  statutes?: KbStatute[];
  deadline_rules?: KbDeadlineRule[];
  rebuttal_table?: KbRebuttalEntry[];
  verification?: KbVerification;
}

function validateKbEntry(filePath: string): void {
  const rel = relative(ROOT, filePath);
  const data = readJson(filePath) as KbEntry | null;
  if (!data) return;

  // Required: statutes array non-empty
  if (!Array.isArray(data.statutes) || data.statutes.length === 0) {
    error(`${rel}: statutes array is missing or empty`);
  }

  // Required: deadline_rules array non-empty
  if (!Array.isArray(data.deadline_rules) || data.deadline_rules.length === 0) {
    error(`${rel}: deadline_rules array is missing or empty`);
  }

  // Required: verification.last_verified exists
  if (!data.verification?.last_verified) {
    error(`${rel}: verification.last_verified is missing`);
  }

  // Required: verification.verified_by non-empty
  if (!data.verification?.verified_by) {
    error(`${rel}: verification.verified_by is missing or empty`);
  }

  // Staleness check
  if (data.verification?.last_verified) {
    const lastVerified = new Date(data.verification.last_verified);
    const now = new Date();
    const diffMs = now.getTime() - lastVerified.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 365) {
      error(`${rel}: last_verified is ${diffDays} days old (> 365 days)`);
    } else if (diffDays > 180) {
      warn(`${rel}: last_verified is ${diffDays} days old (> 180 days)`);
    }
  }

  // Cross-reference: every statute_id in deadline_rules must exist in statutes[]
  if (Array.isArray(data.statutes) && Array.isArray(data.deadline_rules)) {
    const statuteIds = new Set(
      data.statutes.map((s) => s.statute_id).filter(Boolean)
    );

    for (const rule of data.deadline_rules) {
      if (rule.statute_id && !statuteIds.has(rule.statute_id)) {
        error(
          `${rel}: deadline_rules references statute_id "${rule.statute_id}" not found in statutes[]`
        );
      }
    }
  }

  // Cross-reference: every statute_id in rebuttal_table (if present) must exist in statutes[]
  if (Array.isArray(data.statutes) && Array.isArray(data.rebuttal_table)) {
    const statuteIds = new Set(
      data.statutes.map((s) => s.statute_id).filter(Boolean)
    );

    for (const entry of data.rebuttal_table) {
      if (entry.statute_id && !statuteIds.has(entry.statute_id)) {
        error(
          `${rel}: rebuttal_table references statute_id "${entry.statute_id}" not found in statutes[]`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Validate diagnostic graphs
// ---------------------------------------------------------------------------

interface DiagnosticNode {
  id: string;
  type?: string;
  next?: string;
  options?: Array<{ next?: string }>;
  branches?: Record<string, string>;
}

interface DiagnosticGraph {
  entry_node?: string;
  nodes?: Record<string, DiagnosticNode>;
}

function validateDiagnosticGraph(filePath: string): void {
  const rel = relative(ROOT, filePath);
  const data = readJson(filePath) as DiagnosticGraph | null;
  if (!data) return;

  const entryNode = data.entry_node;
  const nodes = data.nodes;

  if (!entryNode || !nodes) {
    error(`${rel}: missing entry_node or nodes`);
    return;
  }

  if (!(entryNode in nodes)) {
    error(`${rel}: entry_node "${entryNode}" not found in nodes`);
    return;
  }

  const nodeIds = new Set(Object.keys(nodes));

  // Collect all edges
  function getSuccessors(node: DiagnosticNode): string[] {
    const successors: string[] = [];
    if (node.next && typeof node.next === 'string') {
      successors.push(node.next);
    }
    if (Array.isArray(node.options)) {
      for (const opt of node.options) {
        if (opt.next && typeof opt.next === 'string') {
          successors.push(opt.next);
        }
      }
    }
    if (node.branches && typeof node.branches === 'object') {
      for (const target of Object.values(node.branches)) {
        if (typeof target === 'string') {
          successors.push(target);
        }
      }
    }
    return successors;
  }

  // Check all referenced nodes exist
  for (const [nodeId, node] of Object.entries(nodes)) {
    const succs = getSuccessors(node);
    for (const s of succs) {
      if (!nodeIds.has(s)) {
        error(`${rel}: node "${nodeId}" references non-existent node "${s}"`);
      }
    }
  }

  // Check reachability from entry node (BFS)
  const visited = new Set<string>();
  const bfsQueue: string[] = [entryNode];
  visited.add(entryNode);

  while (bfsQueue.length > 0) {
    const current = bfsQueue.shift()!;
    const node = nodes[current];
    if (!node) continue;

    const succs = getSuccessors(node);
    for (const s of succs) {
      if (!visited.has(s) && nodeIds.has(s)) {
        visited.add(s);
        bfsQueue.push(s);
      }
    }
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      warn(`${rel}: node "${nodeId}" is not reachable from entry node "${entryNode}"`);
    }
  }

  // Check for cycles using DFS
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
    const node = nodes[nodeId];
    if (!node) {
      color.set(nodeId, BLACK);
      return;
    }

    const succs = getSuccessors(node);
    for (const s of succs) {
      if (!nodeIds.has(s)) continue;
      const c = color.get(s);
      if (c === GRAY) {
        error(`${rel}: cycle detected involving node "${s}"`);
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

  // Check all paths reach a terminal node
  const isTerminal = (nodeId: string): boolean => {
    const node = nodes[nodeId];
    if (!node) return false;
    // Terminal if type is 'terminal' or has no successors
    if (node.type === 'terminal') return true;
    // Some terminal-like types that don't have outgoing edges for user flow
    const succs = getSuccessors(node);
    return succs.length === 0;
  };

  // Check that every reachable non-terminal node has at least one successor
  // and that following successors eventually reaches a terminal
  const reachesTerminal = new Map<string, boolean>();

  function canReachTerminal(nodeId: string, pathSet: Set<string>): boolean {
    if (reachesTerminal.has(nodeId)) {
      return reachesTerminal.get(nodeId)!;
    }
    if (isTerminal(nodeId)) {
      reachesTerminal.set(nodeId, true);
      return true;
    }
    if (pathSet.has(nodeId)) {
      // Cycle — already reported above
      return false;
    }

    pathSet.add(nodeId);
    const node = nodes[nodeId];
    if (!node) {
      reachesTerminal.set(nodeId, false);
      return false;
    }

    const succs = getSuccessors(node);
    if (succs.length === 0) {
      // No successors and not marked terminal — still counts as terminal endpoint
      reachesTerminal.set(nodeId, true);
      return true;
    }

    // All paths must reach terminal
    let allReach = true;
    for (const s of succs) {
      if (nodeIds.has(s) && !canReachTerminal(s, new Set(pathSet))) {
        allReach = false;
      }
    }

    reachesTerminal.set(nodeId, allReach);
    return allReach;
  }

  if (!hasCycle) {
    for (const nodeId of visited) {
      if (!canReachTerminal(nodeId, new Set())) {
        error(`${rel}: node "${nodeId}" has a path that never reaches a terminal`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Validate decline-copy coverage
// ---------------------------------------------------------------------------

function validateDeclineCopyCoverage(): void {
  const tangledPath = join(KB_DIR, 'refusal', 'tangled-case-rules.json');
  const declinePath = join(KB_DIR, 'refusal', 'decline-copy.json');

  if (!existsSync(tangledPath)) {
    warn('tangled-case-rules.json not found, skipping decline-copy coverage check');
    return;
  }
  if (!existsSync(declinePath)) {
    error('decline-copy.json not found but tangled-case-rules.json exists');
    return;
  }

  interface TangledRule {
    rule_id?: string;
  }

  interface TangledCaseRules {
    rules?: TangledRule[];
  }

  interface DeclineCopy {
    decline_messages?: Record<string, unknown>;
  }

  const tangled = readJson(tangledPath) as TangledCaseRules | null;
  const decline = readJson(declinePath) as DeclineCopy | null;

  if (!tangled || !decline) return;

  const rules = tangled.rules;
  const messages = decline.decline_messages;

  if (!Array.isArray(rules)) {
    error('tangled-case-rules.json: rules is not an array');
    return;
  }
  if (!messages || typeof messages !== 'object') {
    error('decline-copy.json: decline_messages is not an object');
    return;
  }

  const messageKeys = new Set(Object.keys(messages));

  for (const rule of rules) {
    if (rule.rule_id && !messageKeys.has(rule.rule_id)) {
      // Also check with common key transformations (e.g., "any-represented-party" might map to "adversarial-counsel-engaged")
      // We check exact match first, then log error
      error(
        `tangled-case-rules.json trigger "${rule.rule_id}" has no matching entry in decline-copy.json`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

info('Validating KB entries...');
const kbEntries = findKbEntries();
if (kbEntries.length === 0) {
  warn('No kb-entry.json files found');
} else {
  for (const entry of kbEntries) {
    info(`  Checking ${relative(ROOT, entry)}`);
    validateKbEntry(entry);
  }
}

info('Validating diagnostic graphs...');
const diagnosticsDir = join(KB_DIR, 'diagnostics');
if (existsSync(diagnosticsDir)) {
  for (const file of readdirSync(diagnosticsDir)) {
    if (file.endsWith('.json')) {
      const filePath = join(diagnosticsDir, file);
      info(`  Checking ${relative(ROOT, filePath)}`);
      validateDiagnosticGraph(filePath);
    }
  }
} else {
  warn('kb/diagnostics/ directory not found');
}

info('Validating decline-copy coverage...');
validateDeclineCopyCoverage();

// ---------------------------------------------------------------------------
// SEO ↔ KB consistency — the marketing pages must not contradict the KB, which
// is the authority the law monitor re-verifies. A drift here is a hard error.
// ---------------------------------------------------------------------------

info('Validating SEO config against the KB (single legal-fact authority)...');
try {
  const mismatches = checkAllJurisdictions();
  for (const m of mismatches) {
    error(
      `SEO/KB drift [${m.jurisdiction}.${m.field}]: SEO="${m.seoValue}" KB="${m.kbValue}" — ${m.detail}`,
    );
  }
  if (mismatches.length === 0) {
    info('  SEO config matches the KB for every jurisdiction.');
  }
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  error(`SEO/KB consistency check failed to run: ${message}`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log('='.repeat(60));
console.log(`KB Validation Complete: ${errors} error(s), ${warnings} warning(s)`);
console.log('='.repeat(60));

if (errors > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
