/**
 * Deposit state mapping — end-to-end integrity
 *
 * The deposit flow spans five sources that must agree on which states are
 * supported and how an unsupported state is handled. When they drift, the
 * anonymous "another state" flow silently dead-ends (empty dropdown, no
 * terminal screen) — the exact bug this suite guards against.
 *
 * Chain under test:
 *   DEPOSIT_JURISDICTION (enums)  — the source of truth: CA/TX/NY/FL
 *     → JURISDICTIONS (seo/config) — one full entry per supported state
 *     → /deposit/<slug> route      — a page exists per supported state
 *     → deposit-graph.json         — jurisdiction node offers exactly those + OTHER
 *     → unsupported_state node     — routes to the unsupported terminal
 *     → STATE_RESOURCES            — resources for every UNsupported state
 *     → select-node.tsx            — renders BOTH state option_sources
 *     → anonymous shell            — routes the unsupported terminal correctly
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { DEPOSIT_JURISDICTION } from '@/types/enums';
import { JURISDICTIONS } from '@/lib/seo/config';
import { STATE_RESOURCES } from '@/lib/kb/state-resources';
import { ALL_US_STATES } from '@/lib/kb/us-states';

const REPO = path.resolve(__dirname, '..', '..');
const graph = JSON.parse(
  fs.readFileSync(path.join(REPO, 'kb', 'diagnostics', 'deposit-graph.json'), 'utf-8'),
) as { nodes: Record<string, GraphNode> };

interface GraphNode {
  id: string;
  type: string;
  field?: string;
  options?: { value: string; label: string; next: string }[];
  options_source?: string;
  next?: string;
  terminal_type?: string;
}

const SUPPORTED = [...DEPOSIT_JURISDICTION];

/* ================================================================== */
/*  1. Config agrees with the source of truth                        */
/* ================================================================== */

describe('deposit state mapping — config', () => {
  it('JURISDICTIONS has exactly one entry per supported state', () => {
    const codes = JURISDICTIONS.map((j) => j.code).sort();
    expect(codes).toEqual([...SUPPORTED].sort());
  });

  it('every supported state has a /deposit/<slug> page route', () => {
    for (const j of JURISDICTIONS) {
      const routeFile = path.join(
        REPO, 'src', 'app', '(marketing)', 'deposit', j.slug, 'page.tsx',
      );
      expect(fs.existsSync(routeFile), `missing route for ${j.code} (${j.slug})`).toBe(true);
    }
  });

  it('every supported state carries statute + deadline + small-claims data', () => {
    for (const j of JURISDICTIONS) {
      expect(j.statuteCitation, `${j.code} statute`).toBeTruthy();
      expect(j.returnDeadlineDays, `${j.code} deadline`).toBeGreaterThan(0);
      expect(j.smallClaimsLimit, `${j.code} small-claims limit`).toBeTruthy();
    }
  });
});

/* ================================================================== */
/*  2. The diagnostic graph's state node matches config              */
/* ================================================================== */

describe('deposit state mapping — graph jurisdiction node', () => {
  const jurisdiction: GraphNode | undefined = graph.nodes.jurisdiction;

  it('exists and is a select', () => {
    expect(jurisdiction).toBeDefined();
    expect(jurisdiction?.type).toBe('select');
  });

  it('offers exactly the supported states plus an OTHER option', () => {
    const values = (jurisdiction?.options ?? []).map((o) => o.value);
    const stateValues = values.filter((v) => v !== 'OTHER');
    expect(stateValues.sort()).toEqual([...SUPPORTED].sort());
    expect(values).toContain('OTHER');
  });

  it('OTHER routes to the unsupported_state node', () => {
    const other = (jurisdiction?.options ?? []).find((o) => o.value === 'OTHER');
    expect(other?.next).toBe('unsupported_state');
  });
});

/* ================================================================== */
/*  3. The unsupported-state node reaches the terminal              */
/* ================================================================== */

describe('deposit state mapping — unsupported path', () => {
  const unsupported: GraphNode | undefined = graph.nodes.unsupported_state;

  it('unsupported_state is a select sourced from us_states_minus_supported', () => {
    expect(unsupported).toBeDefined();
    expect(unsupported?.type).toBe('select');
    // This exact value must be handled by select-node.tsx (guarded below).
    expect(unsupported?.options_source).toBe('us_states_minus_supported');
  });

  it('routes to a terminal of type unsupported_jurisdiction', () => {
    const terminal: GraphNode | undefined = graph.nodes[unsupported?.next ?? ''];
    expect(terminal).toBeDefined();
    expect(terminal?.type).toBe('terminal');
    expect(terminal?.terminal_type).toBe('unsupported_jurisdiction');
  });
});

/* ================================================================== */
/*  4. Resources cover every unsupported state                       */
/* ================================================================== */

describe('deposit state mapping — resources', () => {
  const allCodes = ALL_US_STATES.map((s) => s.code);
  const unsupportedCodes = allCodes.filter((c) => !SUPPORTED.includes(c as never));

  it('STATE_RESOURCES has an entry for every unsupported state', () => {
    const missing = unsupportedCodes.filter((c) => !STATE_RESOURCES[c]);
    expect(missing, `missing resources: ${missing.join(', ')}`).toEqual([]);
  });

  it('STATE_RESOURCES does NOT list supported states (they use the real flow)', () => {
    const wrong = SUPPORTED.filter((c) => STATE_RESOURCES[c]);
    expect(wrong, `supported states wrongly in resources: ${wrong.join(', ')}`).toEqual([]);
  });

  it('every resource entry has all four official links', () => {
    for (const [code, r] of Object.entries(STATE_RESOURCES)) {
      expect(r.deposit_statute_url, `${code} statute url`).toMatch(/^https?:\/\//);
      expect(r.small_claims_url, `${code} small-claims url`).toMatch(/^https?:\/\//);
      expect(r.legal_aid_url, `${code} legal-aid url`).toMatch(/^https?:\/\//);
      expect(r.ag_complaint_url, `${code} AG url`).toMatch(/^https?:\/\//);
    }
  });
});

/* ================================================================== */
/*  5. The frontend can actually render the unsupported dropdown     */
/*     + the anonymous shell routes the terminal to the right screen */
/* ================================================================== */

describe('deposit state mapping — frontend wiring', () => {
  const selectNode = fs.readFileSync(
    path.join(REPO, 'src', 'features', 'diagnostic', 'components', 'nodes', 'select-node.tsx'),
    'utf-8',
  );
  const shell = fs.readFileSync(
    path.join(REPO, 'src', 'features', 'diagnostic', 'anonymous', 'anonymous-diagnostic-shell.tsx'),
    'utf-8',
  );

  it('select-node handles the us_states_minus_supported source', () => {
    // Regression guard: it previously only knew "all_us_states", so the
    // unsupported dropdown rendered empty ("No options available").
    expect(selectNode).toContain('us_states_minus_supported');
  });

  it('the anonymous shell routes unsupported_jurisdiction to the coming-soon screen', () => {
    expect(shell).toContain('UnsupportedJurisdictionScreen');
    expect(shell).toContain("terminal_type === 'unsupported_jurisdiction'");
  });

  it('the generic-letter link points at the served route, not the un-served /kb path', () => {
    // /kb/* is not a served static asset in production; the API route reads it
    // server-side. Guard against regressing to the 404-in-prod path.
    expect(shell.includes('/kb/unsupported/generic-demand-letter.md')).toBe(false);
  });
});
