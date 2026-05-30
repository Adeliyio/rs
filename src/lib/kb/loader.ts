/**
 * KB file loader — server-only.
 *
 * Reads and caches KB JSON (and Markdown) files from disk using
 * synchronous readFileSync.  Files are small and loaded once; the
 * in-memory Map cache prevents redundant I/O on subsequent calls.
 *
 * No Zod validation here — callers can pipe results through the
 * validator (src/lib/kb/validator.ts) when runtime checks are needed.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DiagnosticGraph } from '@/types/diagnostic.types';
import type {
  KbEntry,
  VerticalTemplate,
  TangledCaseRules,
  DeclineCopy,
  AdversarialCounselTrigger,
  SubscriptionBase,
  DisclaimersFile,
} from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Cache                                                             */
/* ------------------------------------------------------------------ */

const cache = new Map<string, unknown>();

function resolveKbPath(...segments: string[]): string {
  return join(process.cwd(), 'kb', ...segments);
}

function loadJsonFile<T>(filePath: string): T {
  const cached = cache.get(filePath);
  if (cached !== undefined) {
    return cached as T;
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as T;
    cache.set(filePath, parsed);
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`KB loader: failed to load ${filePath} — ${message}`);
  }
}

function loadTextFile(filePath: string): string {
  const cached = cache.get(filePath);
  if (typeof cached === 'string') {
    return cached;
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    cache.set(filePath, raw);
    return raw;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`KB loader: failed to load ${filePath} — ${message}`);
  }
}

/* ------------------------------------------------------------------ */
/*  Public loader functions                                           */
/* ------------------------------------------------------------------ */

/**
 * Load a diagnostic graph for the given wedge.
 * File: kb/diagnostics/{wedge}-graph.json
 */
export function loadDiagnosticGraph(
  wedge: 'deposit' | 'subscription',
): DiagnosticGraph {
  const filePath = resolveKbPath('diagnostics', `${wedge}-graph.json`);
  return loadJsonFile<DiagnosticGraph>(filePath);
}

/**
 * Load a jurisdiction-specific KB entry.
 * File: kb/{wedge}/{jurisdiction}/kb-entry.json
 */
export function loadKbEntry(
  wedge: string,
  jurisdiction: string,
): KbEntry {
  const filePath = resolveKbPath(wedge, jurisdiction, 'kb-entry.json');
  return loadJsonFile<KbEntry>(filePath);
}

/**
 * Load a vertical-specific template for the subscription wedge.
 * File: kb/subscription/verticals/{vertical}.json
 */
export function loadVerticalTemplate(vertical: string): VerticalTemplate {
  const filePath = resolveKbPath('subscription', 'verticals', `${vertical}.json`);
  return loadJsonFile<VerticalTemplate>(filePath);
}

/**
 * Load tangled-case refusal rules.
 * File: kb/refusal/tangled-case-rules.json
 */
export function loadRefusalRules(): TangledCaseRules {
  const filePath = resolveKbPath('refusal', 'tangled-case-rules.json');
  return loadJsonFile<TangledCaseRules>(filePath);
}

/**
 * Load decline copy messages.
 * File: kb/refusal/decline-copy.json
 */
export function loadDeclineCopy(): DeclineCopy {
  const filePath = resolveKbPath('refusal', 'decline-copy.json');
  return loadJsonFile<DeclineCopy>(filePath);
}

/**
 * Load adversarial-counsel trigger configuration.
 * File: kb/refusal/adversarial-counsel-trigger.json
 */
export function loadAdversarialCounselTrigger(): AdversarialCounselTrigger {
  const filePath = resolveKbPath('refusal', 'adversarial-counsel-trigger.json');
  return loadJsonFile<AdversarialCounselTrigger>(filePath);
}

/**
 * Load compliance disclaimers.
 * File: kb/compliance/disclaimers.json
 */
export function loadDisclaimers(): DisclaimersFile {
  const filePath = resolveKbPath('compliance', 'disclaimers.json');
  return loadJsonFile<DisclaimersFile>(filePath);
}

/**
 * Load a letter Markdown template for a specific wedge + jurisdiction.
 * File: kb/{wedge}/{jurisdiction}/letter-template.md
 */
export function loadLetterTemplate(
  wedge: string,
  jurisdiction: string,
): string {
  const filePath = resolveKbPath(wedge, jurisdiction, 'letter-template.md');
  return loadTextFile(filePath);
}

/**
 * Load a rebuttal table for a specific wedge + jurisdiction.
 * File: kb/{wedge}/{jurisdiction}/rebuttal-table.json
 */
export function loadRebuttalTable(
  wedge: string,
  jurisdiction: string,
): unknown {
  const filePath = resolveKbPath(wedge, jurisdiction, 'rebuttal-table.json');
  return loadJsonFile<unknown>(filePath);
}

/**
 * Load the subscription base configuration.
 * File: kb/subscription/_subscription-base.json
 */
export function loadSubscriptionBase(): SubscriptionBase {
  const filePath = resolveKbPath('subscription', '_subscription-base.json');
  return loadJsonFile<SubscriptionBase>(filePath);
}

