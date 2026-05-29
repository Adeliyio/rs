/**
 * POST /api/cases/[id]/refusal
 *
 * Records a refusal trigger on a case, updates the case status to
 * "closed", and creates a case_status_history entry.
 *
 * Body: { refusal_trigger: string }
 * RLS on the cases table enforces ownership.
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type CaseRow = Pick<Tables<'cases'>, 'id' | 'status'>;

interface RefusalRequestBody {
  refusal_trigger: string;
}

function isValidBody(body: unknown): body is RefusalRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'refusal_trigger' in body &&
    typeof (body as RefusalRequestBody).refusal_trigger === 'string' &&
    (body as RefusalRequestBody).refusal_trigger.length > 0
  );
}

/* ------------------------------------------------------------------ */
/*  POST                                                              */
/* ------------------------------------------------------------------ */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    /* ---- Auth ---- */
    const supabase = await createClient();
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

    /* ---- Parse body ---- */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: 'Missing or invalid refusal_trigger field' },
        { status: 400 },
      );
    }

    const { refusal_trigger } = body;

    /* ---- Fetch case (RLS ensures ownership) ---- */
    const { data, error: fetchError } = await supabase
      .from('cases')
      .select('id, status')
      .eq('id', caseId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 },
      );
    }

    const existingCase = data as unknown as CaseRow;
    const previousStatus = existingCase.status;

    /* ---- Update case ---- */
    const updatePayload: Record<string, unknown> = {
      refusal_trigger,
      status: 'closed',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedData, error: updateError } = await supabase
      .from('cases')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
      .update(updatePayload)
      .eq('id', caseId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update case' },
        { status: 500 },
      );
    }

    /* ---- Create status history entry ---- */
    const historyPayload: Record<string, unknown> = {
      case_id: caseId,
      previous_status: previousStatus,
      new_status: 'closed',
    };

    const { error: historyError } = await supabase
      .from('case_status_history')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type from manual Database definition
      .insert(historyPayload);

    if (historyError) {
      // Non-critical — log but don't fail the request
      // eslint-disable-next-line no-console
      console.error(
        'Failed to create case_status_history entry:',
        historyError.message,
      );
    }

    return NextResponse.json({ case: updatedData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
