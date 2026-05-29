/* eslint-disable @typescript-eslint/no-explicit-any -- Manual DB types; remove after pnpm db:gen-types */
/**
 * POST /api/documents/[id]/confirm
 *
 * Receives user-confirmed field values, saves them to the document's
 * confirmed_json column, sets parse_status to 'confirmed', and records
 * authenticity_ack = true.
 *
 * Body: { confirmed_fields: Record<string, unknown> }
 * Returns: { ok: true }
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ConfirmRequestBody {
  confirmed_fields: Record<string, unknown>;
}

function isValidBody(body: unknown): body is ConfirmRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'confirmed_fields' in body &&
    typeof (body as ConfirmRequestBody).confirmed_fields === 'object' &&
    (body as ConfirmRequestBody).confirmed_fields !== null
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
    const { id: documentId } = await params;

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
        { error: 'Missing or invalid confirmed_fields in request body' },
        { status: 400 },
      );
    }

    const { confirmed_fields } = body;

    /* ---- Verify document exists and user has access (via case RLS) ---- */
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('id, case_id, parse_status')
      .eq('id', documentId)
      .single();

    if (docError || !docData) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 },
      );
    }

    /* ---- Update document ---- */
    const updatePayload: Record<string, unknown> = {
      confirmed_json: confirmed_fields,
      parse_status: 'confirmed',
      authenticity_ack: true,
      updated_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase
      .from('documents') as any)
      .update(updatePayload)
      .eq('id', documentId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to confirm document: ${updateError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
