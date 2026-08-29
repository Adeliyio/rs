/**
 * POST /api/documents/[id]/confirm
 *
 * Saves user-confirmed field values (confirmed_json), sets parse_status to
 * 'confirmed', and records authenticity_ack = true. Ownership enforced inside
 * documents.confirmMine (via the parent case).
 */

import { NextResponse } from 'next/server';

import { m, currentUser, api } from '@/lib/convex/server';
import type { Id } from '@convex/dataModel';

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

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: 'Missing or invalid confirmed_fields in request body' },
        { status: 400 },
      );
    }

    try {
      await m(api.documents.confirmMine, {
        documentId: documentId as Id<'documents'>,
        confirmedFields: body.confirmed_fields,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not found')) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
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
