/**
 * GET/POST /api/cases/[id]/outcome — record and retrieve case outcomes (Convex).
 *
 * Ownership enforced inside outcomes.getByCaseMine / outcomes.upsertMine.
 * The upsert replaces the old .upsert({ onConflict: 'case_id' }).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { q, m, currentUser, api } from '@/lib/convex/server';
import type { Id } from '@convex/dataModel';

/**
 * Outcome body — Zod-validated so a user can't inject an unbounded
 * `recovered_amount` (which feeds the public "total recovered" stat). Cap at
 * $1,000,000 (in the same unit the app stores) and a strict consent shape.
 */
const outcomeBodySchema = z.object({
  outcome_category: z.string().min(1).max(64),
  stage: z.string().min(1).max(64),
  recovered_amount: z.number().min(0).max(1_000_000).optional(),
  testimonial: z.string().max(2000).optional(),
  consent: z
    .object({ share_outcome: z.boolean().optional() })
    .passthrough()
    .optional(),
});
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

    try {
      const outcome = await q(api.outcomes.getByCaseMine, { caseId: caseId as Id<'cases'> });
      return NextResponse.json({ outcome });
    } catch {
      // Not found / not owned → null (matches old behaviour)
      return NextResponse.json({ outcome: null });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}


export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;
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
    const parsed = outcomeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const data = parsed.data;

    try {
      const outcome = await m(api.outcomes.upsertMine, {
        caseId: caseId as Id<'cases'>,
        stage: data.stage,
        outcomeCategory: data.outcome_category,
        recoveredAmount: data.recovered_amount,
        testimonial: data.testimonial,
        consent: data.consent,
      });
      return NextResponse.json({ outcome });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not found')) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
