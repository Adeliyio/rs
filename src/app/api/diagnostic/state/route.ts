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
import type { DiagnosticState } from '@/types/diagnostic.types';
import type { Wedge } from '@/types/enums';
import type { Id } from '@convex/dataModel';
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
    const state = caseRow.diagnostic_state as DiagnosticState | null;

    // Decrypt PII fields before sending to the client
    const decryptedState = state && state.answers
      ? { ...state, answers: decryptAnswersPii(state.answers) }
      : state;

    return NextResponse.json({ graph, state: decryptedState });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
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

    // If the diagnostic collected a jurisdiction answer, sync it to the case.
    const jurisdictionAnswer = body.state.answers?.jurisdiction as string | undefined;

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
