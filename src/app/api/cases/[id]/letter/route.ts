/**
 * GET /api/cases/[id]/letter — most recent generated letter for a case.
 * Ownership enforced by letters.latestByCaseMine (via parent case).
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import type { Id } from '@convex/dataModel';
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

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

    let letter;
    try {
      letter = await q(api.letters.latestByCaseMine, { caseId: caseId as Id<'cases'> });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not found')) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }
      throw err;
    }

    if (!letter) {
      return NextResponse.json({ error: 'No letter found for this case.' }, { status: 404 });
    }

    // Extract a rebuttal table if present in the content (unchanged logic).
    let rebuttalTable: string | undefined;
    const tableMatch = letter.content.match(/\|.*Landlord.*Deduction.*\|[\s\S]*?\|.*\|/);
    if (tableMatch) rebuttalTable = tableMatch[0];

    return NextResponse.json({
      id: letter.id,
      content: letter.content,
      pdf_url: letter.pdf_url,
      rebuttal_table: rebuttalTable,
      created_at: letter.created_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('GET /api/cases/[id]/letter error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
