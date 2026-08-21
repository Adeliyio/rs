/**
 * GET/POST /api/cases/[id]/outcome — record and retrieve case outcomes (Convex).
 *
 * Ownership enforced inside outcomes.getByCaseMine / outcomes.upsertMine.
 * The upsert replaces the old .upsert({ onConflict: 'case_id' }).
 */

import { NextResponse } from 'next/server';

import { q, m, currentUser, api } from '@/lib/convex/server';
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

    try {
      const outcome = await q(api.outcomes.getByCaseMine, { caseId: caseId as Id<'cases'> });
      return NextResponse.json({ outcome });
    } catch {
      // Not found / not owned → null (matches old behaviour)
      return NextResponse.json({ outcome: null });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface OutcomeBody {
  outcome_category: string;
  stage: string;
  recovered_amount?: number;
  testimonial?: string;
  consent?: unknown;
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

    const body = (await request.json()) as OutcomeBody;
    if (!body.outcome_category || !body.stage) {
      return NextResponse.json({ error: 'Missing outcome_category or stage' }, { status: 400 });
    }

    try {
      const outcome = await m(api.outcomes.upsertMine, {
        caseId: caseId as Id<'cases'>,
        stage: body.stage,
        outcomeCategory: body.outcome_category,
        recoveredAmount: body.recovered_amount,
        testimonial: body.testimonial,
        consent: body.consent,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
