/**
 * GET /api/cases/[id]/payment-status — lightweight payment-status poll.
 * Ownership enforced by cases.getMine.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import type { Id } from '@convex/dataModel';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    return NextResponse.json({ payment_status: caseRow.payment_status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
