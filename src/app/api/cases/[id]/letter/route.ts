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

    // Read the PERSISTED table. This used to scrape it back out of the letter
    // body with a regex whose lazy `[\s\S]*?` stopped at the markdown separator
    // row — so it could only ever capture "header + separator", which the
    // renderer then filtered down to ZERO rows. And since the model returns the
    // table in its own field rather than inline, the regex usually matched
    // nothing at all. Now that the field is stored, read it directly.
    const rebuttalTable = letter.rebuttal_table ?? undefined;

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
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
