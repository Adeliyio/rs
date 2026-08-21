/**
 * POST /api/sequences/[id]/advance
 *
 * Advances a subscription email sequence to the next step. The step validation,
 * sent-timestamp stamping, next_send_at calc, and case status transition all
 * happen atomically inside sequences.advanceStepMine (owner-gated). The next-step
 * reminder email (BullMQ) stays here.
 *
 * Body: { step_number: number }
 */

import { NextResponse } from 'next/server';

import { m, currentUser, api } from '@/lib/convex/server';
import { enqueueSequenceStepEmail } from '@/lib/queue/enqueue';
import type { Id } from '@convex/dataModel';

interface AdvanceRequestBody {
  step_number: number;
}

function isValidBody(body: unknown): body is AdvanceRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'step_number' in body &&
    typeof (body as AdvanceRequestBody).step_number === 'number'
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sequenceId } = await params;

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
      return NextResponse.json({ error: 'Missing or invalid step_number field' }, { status: 400 });
    }

    const { step_number } = body;

    let result;
    try {
      result = await m(api.sequences.advanceStepMine, {
        sequenceId: sequenceId as Id<'sequences'>,
        stepNumber: step_number,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not found')) {
        return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
      }
      if (msg.startsWith('STEP_MISMATCH')) {
        const [, expected] = msg.split(':');
        return NextResponse.json(
          { error: `Step mismatch: expected step ${expected}, got ${step_number}.` },
          { status: 409 },
        );
      }
      throw err;
    }

    /* ---- Next-step reminder email (best-effort) ---- */
    if (!result.isComplete) {
      try {
        const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
        await enqueueSequenceStepEmail(
          user.email ?? '',
          result.nextStep,
          result.nextStepName,
          result.companyName,
          result.caseId,
          `${appUrl}/case/${result.caseId}`,
        );
      } catch (emailErr) {
        // eslint-disable-next-line no-console
        console.error('Failed to enqueue sequence step reminder:', emailErr);
      }
    }

    return NextResponse.json({ ok: true, complete: result.isComplete });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/sequences/[id]/advance error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
