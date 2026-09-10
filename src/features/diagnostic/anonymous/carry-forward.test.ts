import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  savePendingDiagnostic,
  readPendingDiagnostic,
  consumePendingDiagnostic,
  clearPendingDiagnostic,
} from './pending-answers';
import { buildHydratedState } from './anonymous-answers';

/**
 * Regression guard for the "I had to fill the form twice" defect.
 *
 * Two independent holes let a visitor lose every anonymously-collected answer:
 *
 *  1. NEW USER: useResolvaioAuth().verifyEmail() ended with an unconditional
 *     router.push('/new'). The email-capture step awaited it and THEN ran two
 *     network round-trips (create case → hydrate state) before its own redirect.
 *     '/new' (the wedge picker) won the race, so the visitor restarted the
 *     diagnostic from scratch — and the hydration PUT could be torn down
 *     mid-flight, losing the answers server-side too.
 *
 *  2. RETURNING USER: "Sign in instead" navigated to /login, destroying the
 *     React tree that was the ONLY home of the answers.
 *
 * The fixtures below are PRODUCTION-SHAPED on purpose: answers keyed by NODE ID,
 * group nodes as nested objects, booleans as the strings 'true'/'false', currency
 * as numbers. Convenient flat mock data is exactly what let these bugs stay green.
 */

const PRODUCTION_SHAPED_ANSWERS: Record<string, unknown> = {
  jurisdiction: 'CA',
  deposit_amount: 2400,
  move_out_date: '2026-06-30',
  landlord_details: {
    landlord_name: 'Acme Property Management',
    landlord_address: '500 Market St, San Francisco, CA 94105',
  },
  itemization_received: 'false',
  deductions_disputed: 'true',
  deduction_items: {
    cleaning: 450,
    painting: 800,
  },
};

const COMPLETED_NODES = [
  'jurisdiction',
  'deposit_amount',
  'move_out_date',
  'landlord_details',
  'itemization_received',
  'deductions_disputed',
  'deduction_items',
];

/** Minimal in-memory sessionStorage so the module under test can run in node. */
function installSessionStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (k: string): string | null => store.get(k) ?? null,
      setItem: (k: string, v: string): void => void store.set(k, v),
      removeItem: (k: string): void => void store.delete(k),
    },
  });
}

beforeEach(() => {
  installSessionStorage();
  clearPendingDiagnostic();
});

describe('pending-answers stash (survives the /login navigation)', () => {
  it('round-trips production-shaped answers verbatim', () => {
    const saved = savePendingDiagnostic({
      wedge: 'deposit',
      jurisdiction: 'CA',
      graphVersion: 'deposit-v3',
      boundaryNodeId: 'document_upload',
      answers: PRODUCTION_SHAPED_ANSWERS,
      completedNodes: COMPLETED_NODES,
    });
    expect(saved).toBe(true);

    const pending = readPendingDiagnostic();
    expect(pending).not.toBeNull();

    // Nested group nodes, 'true'/'false' strings and numeric currency must all
    // survive the JSON hop unchanged — the authenticated shell reads them by
    // node id and silently drops anything reshaped.
    expect(pending?.answers).toEqual(PRODUCTION_SHAPED_ANSWERS);
    expect(pending?.answers.itemization_received).toBe('false');
    expect(pending?.answers.deposit_amount).toBe(2400);
    expect(
      (pending?.answers.landlord_details as Record<string, unknown>)
        .landlord_name,
    ).toBe('Acme Property Management');
    expect(pending?.completedNodes).toEqual(COMPLETED_NODES);
    expect(pending?.boundaryNodeId).toBe('document_upload');
  });

  it('consume() clears the stash so a resume cannot be replayed', () => {
    savePendingDiagnostic({
      wedge: 'deposit',
      jurisdiction: 'CA',
      graphVersion: 'deposit-v3',
      boundaryNodeId: 'document_upload',
      answers: PRODUCTION_SHAPED_ANSWERS,
      completedNodes: COMPLETED_NODES,
    });

    expect(consumePendingDiagnostic()).not.toBeNull();
    expect(consumePendingDiagnostic()).toBeNull();
  });

  it('discards an expired stash rather than resuming a stale diagnostic', () => {
    savePendingDiagnostic({
      wedge: 'deposit',
      jurisdiction: 'CA',
      graphVersion: 'deposit-v3',
      boundaryNodeId: 'document_upload',
      answers: PRODUCTION_SHAPED_ANSWERS,
      completedNodes: COMPLETED_NODES,
    });

    // Two hours later — past the 1-hour TTL.
    const twoHours = 2 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + twoHours);
    expect(readPendingDiagnostic()).toBeNull();
    vi.restoreAllMocks();
  });

  it('returns null (never throws) when storage is unavailable', () => {
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (): string => {
          throw new Error('storage disabled');
        },
        setItem: (): void => {
          throw new Error('storage disabled');
        },
        removeItem: (): void => {
          throw new Error('storage disabled');
        },
      },
    });

    expect(
      savePendingDiagnostic({
        wedge: 'deposit',
        jurisdiction: 'CA',
        graphVersion: 'deposit-v3',
        boundaryNodeId: 'document_upload',
        answers: PRODUCTION_SHAPED_ANSWERS,
        completedNodes: COMPLETED_NODES,
      }),
    ).toBe(false);
    expect(readPendingDiagnostic()).toBeNull();
  });

  it('rejects a malformed stash from an older build', () => {
    const store = new Map<string, string>([
      ['resolvaio:pending-diagnostic', JSON.stringify({ answers: {} })],
    ]);
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string): string | null => store.get(k) ?? null,
        setItem: (k: string, v: string): void => void store.set(k, v),
        removeItem: (k: string): void => void store.delete(k),
      },
    });

    expect(readPendingDiagnostic()).toBeNull();
  });
});

describe('the resume page must stay on the origin that holds the stash', () => {
  /**
   * The first version of this fix was INERT in production and passed every unit
   * test above. sessionStorage is PER-ORIGIN; middleware redirects an
   * authenticated user from the root domain to the app subdomain for any path
   * that is not in PUBLIC_ROUTES. Because PUBLIC_ROUTES is matched EXACTLY,
   * '/start' did not cover '/start/resume' — so the resume page loaded on a
   * different origin, read an empty stash, and sent the visitor back to an empty
   * funnel to re-answer everything. Locally it "worked" only because the
   * redirect is skipped in dev.
   *
   * There is no unit-testable seam for this (isPublicPath is module-private and
   * the redirect is edge middleware), so we assert on the source itself — the
   * same approach other suites in this repo use for route-shape guarantees.
   */
  const middlewareSource = readFileSync(
    join(process.cwd(), 'src', 'middleware.ts'),
    'utf-8',
  );

  it("lists '/start/resume' in PUBLIC_ROUTES so no cross-origin redirect occurs", () => {
    const publicRoutesBlock = middlewareSource.slice(
      middlewareSource.indexOf('const PUBLIC_ROUTES'),
      middlewareSource.indexOf('];', middlewareSource.indexOf('const PUBLIC_ROUTES')),
    );
    expect(publicRoutesBlock).toContain("'/start/resume'");
  });

  it('still matches public routes exactly (the reason the bug existed)', () => {
    // If this ever becomes a prefix match, '/start/resume' would be covered by
    // '/start' and the explicit entry could be dropped — but until then the
    // entry above is load-bearing.
    expect(middlewareSource).toContain('PUBLIC_ROUTES.includes(pathname)');
  });
});

describe('stash → hydrated state (what the authenticated shell resumes from)', () => {
  it('carries every answer to the boundary node, nothing re-asked', () => {
    savePendingDiagnostic({
      wedge: 'deposit',
      jurisdiction: 'CA',
      graphVersion: 'deposit-v3',
      boundaryNodeId: 'document_upload',
      answers: PRODUCTION_SHAPED_ANSWERS,
      completedNodes: COMPLETED_NODES,
    });

    const pending = consumePendingDiagnostic();
    expect(pending).not.toBeNull();

    const state = buildHydratedState({
      caseId: 'case_abc123',
      graphVersion: pending!.graphVersion,
      boundaryNodeId: pending!.boundaryNodeId,
      answers: pending!.answers,
      completedNodes: pending!.completedNodes,
    });

    // The visitor resumes AT the boundary, not at the first question.
    expect(state.current_node).toBe('document_upload');
    expect(state.case_id).toBe('case_abc123');
    expect(state.is_completed).toBe(false);

    // Every node they already answered is still answered and still marked done.
    expect(state.answers).toEqual(PRODUCTION_SHAPED_ANSWERS);
    for (const node of COMPLETED_NODES) {
      expect(state.completed_nodes).toContain(node);
    }
  });
});
