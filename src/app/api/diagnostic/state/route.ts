/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-imports, @typescript-eslint/no-floating-promises -- Manual DB types cause any leakage; remove after pnpm db:gen-types */
/**
 * Diagnostic state API route.
 *
 * GET  /api/diagnostic/state?caseId=X          → loads graph + state
 * GET  /api/diagnostic/state?disclaimers=true   → loads disclaimers
 * PUT  /api/diagnostic/state  { caseId, state } → saves state
 *
 * Both endpoints authenticate via the Supabase server client (RLS).
 * The GET endpoint also loads the graph from the KB loader so the
 * client never needs filesystem access.
 */

import { NextRequest, NextResponse } from 'next/server';

import { q, m, currentUser, api } from '@/lib/convex/server';
import { loadDiagnosticGraph, loadDisclaimers } from '@/lib/kb/loader';
import { encryptAnswersPii, decryptAnswersPii } from '@/lib/crypto';
import { ALL_US_STATES } from '@/lib/kb/us-states';
import { createInitialState, advanceState } from '@/features/diagnostic/engine/state-manager';
import { getNextNodeId } from '@/features/diagnostic/engine/graph-traversal';
import type { DiagnosticGraph, DiagnosticState } from '@/types/diagnostic.types';
import type { Wedge } from '@/types/enums';
import type { Id } from '@convex/dataModel';

/**
 * Seed a fresh diagnostic state so the graph's entry `jurisdiction` node is NOT
 * re-asked when the case was already created WITH a jurisdiction (the EmptyState
 * wedge modal collects the state, then the graph's first node used to ask it
 * again — the double state-pick). Both graphs use entry_node 'jurisdiction'.
 *
 * We only seed when the entry node really is the jurisdiction select AND the
 * stored jurisdiction resolves to a valid next node (i.e. it's a supported
 * option, not 'OTHER'/unsupported). Otherwise we fall back to a normal fresh
 * state and let the node ask, so the anonymous/edge paths are unaffected.
 */
function seedJurisdiction(
  caseId: string,
  graph: DiagnosticGraph,
  jurisdiction: string | null | undefined,
): DiagnosticState | null {
  if (!jurisdiction) return null;
  const entryId = graph.entry_node;
  const entryNode = graph.nodes[entryId];
  if (!entryNode || entryId !== 'jurisdiction' || entryNode.type !== 'select') {
    return null;
  }
  const code = jurisdiction.toUpperCase();
  const nextNodeId = getNextNodeId(entryNode, code);
  // Only skip the node if this jurisdiction has a defined onward transition and
  // it isn't the unsupported-state branch (that branch must be reached via the
  // node itself, never silently seeded past).
  if (!nextNodeId || nextNodeId === 'unsupported_state') return null;
  const fresh = createInitialState(caseId, graph.version ?? '', entryId);
  return advanceState(fresh, entryId, code, nextNodeId);
}
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  GET                                                               */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    /* ---- Disclaimers sub-route ---- */
    if (searchParams.get('disclaimers') === 'true') {
      const disclaimers = loadDisclaimers();
      return NextResponse.json(disclaimers);
    }

    /* ---- Graph + state ---- */
    const caseId = searchParams.get('caseId');
    if (!caseId) {
      return NextResponse.json(
        { error: 'Missing caseId parameter' },
        { status: 400 },
      );
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load the case (ownership enforced by cases.getMine)
    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Load the diagnostic graph from KB
    const graph = loadDiagnosticGraph(caseRow.wedge as Wedge);

    // Return graph + existing state (may be null for new cases)
    let state = caseRow.diagnostic_state as DiagnosticState | null;

    // No persisted state yet → this is the first load of a freshly-created case.
    // Pre-seed the jurisdiction the case was created with so the diagnostic does
    // not ask the user for their state a SECOND time (the EmptyState modal
    // already collected it). Falls back to null (normal fresh start) when the
    // jurisdiction can't be safely seeded past.
    if (!state) {
      state = seedJurisdiction(caseId, graph, caseRow.jurisdiction);
    }

    // Decrypt PII fields before sending to the client
    const decryptedState = state && state.answers
      ? { ...state, answers: decryptAnswersPii(state.answers) }
      : state;

    return NextResponse.json({ graph, state: decryptedState });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PUT                                                               */
/* ------------------------------------------------------------------ */

interface PutBody {
  caseId: string;
  state: DiagnosticState;
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as PutBody;

    if (!body.caseId || !body.state) {
      return NextResponse.json(
        { error: 'Missing caseId or state in body' },
        { status: 400 },
      );
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If the diagnostic collected a jurisdiction answer, sync it to the case —
    // but ONLY if it's a valid US state code. The client could otherwise
    // override the case jurisdiction with arbitrary text (bypassing the enum
    // check done at case creation), affecting KB load and deadline calc.
    const rawJurisdiction = body.state.answers?.jurisdiction;
    const validStateCodes = new Set(ALL_US_STATES.map((s) => s.code));
    const jurisdictionAnswer =
      typeof rawJurisdiction === 'string' && validStateCodes.has(rawJurisdiction.toUpperCase())
        ? rawJurisdiction.toUpperCase()
        : undefined;

    // Encrypt PII fields before saving (VULN-02).
    const encryptedState: DiagnosticState = body.state.answers
      ? { ...body.state, answers: encryptAnswersPii(body.state.answers) }
      : body.state;

    try {
      await m(api.cases.saveDiagnosticState, {
        caseId: body.caseId as Id<'cases'>,
        diagnosticState: encryptedState,
        jurisdiction: jurisdictionAnswer,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not found')) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
