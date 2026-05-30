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

import { createClient } from '@/lib/supabase/server';
import { loadDiagnosticGraph, loadDisclaimers } from '@/lib/kb/loader';
import { encryptAnswersPii, decryptAnswersPii } from '@/lib/crypto';
import type { DiagnosticState } from '@/types/diagnostic.types';
import type { Tables, UpdateTables } from '@/types/database.types';
import type { Wedge } from '@/types/enums';

type CaseRow = Pick<Tables<'cases'>, 'id' | 'wedge' | 'diagnostic_state'>;

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

    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Load the case (RLS ensures user can only see their own)
    const { data, error: caseError } = await supabase
      .from('cases')
      .select('id, wedge, diagnostic_state')
      .eq('id', caseId)
      .single();

    if (caseError || !data) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 },
      );
    }

    const caseRow = data as unknown as CaseRow;

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

    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // If the diagnostic collected a jurisdiction answer, sync it to the case row
    const jurisdictionAnswer = body.state.answers?.jurisdiction as string | undefined;

    // Encrypt PII fields before saving to the database (VULN-02)
    const encryptedState: DiagnosticState = body.state.answers
      ? { ...body.state, answers: encryptAnswersPii(body.state.answers) }
      : body.state;

    // Update diagnostic_state on the case (RLS validates ownership)
    const updatePayload: UpdateTables<'cases'> = {
      diagnostic_state: encryptedState as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
      ...(jurisdictionAnswer ? { jurisdiction: jurisdictionAnswer } : {}),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from('cases') as any)
      .update(updatePayload)
      .eq('id', body.caseId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
