/**
 * POST /api/cases/[id]/refusal
 *
 * Records a refusal trigger, closes the case, and writes a status-history row —
 * atomically inside caseStatus.setRefusalMine (owner-gated).
 */

import { NextResponse } from 'next/server';

import { m, currentUser, api } from '@/lib/convex/server';
import type { Id } from '@convex/dataModel';

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

    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Missing or invalid refusal_trigger field' }, { status: 400 });
    }

    let updated;
    try {
      updated = await m(api.caseStatus.setRefusalMine, {
        caseId: caseId as Id<'cases'>,
        refusalTrigger: body.refusal_trigger,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not found')) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }
      throw err;
    }

    return NextResponse.json({ case: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
