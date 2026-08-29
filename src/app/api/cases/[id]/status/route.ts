/**
 * POST /api/cases/[id]/status — advance a case through the status state machine.
 *
 * The transition validation + history insert now happen atomically inside the
 * Convex mutation `caseStatus.transitionMine` (which enforces ownership). The
 * outcome-email scheduling side-effect stays here (it uses BullMQ/Redis).
 */

import { NextResponse } from 'next/server';

import { m, currentUser, api } from '@/lib/convex/server';
import { scheduleOutcomeEmails, cancelOutcomeEmails } from '@/lib/outcomes/outcome-scheduler';
import { CASE_STATUS } from '@/types/enums';
import type { Id } from '@convex/dataModel';

interface StatusRequestBody {
  new_status: string;
}

function isValidBody(body: unknown): body is StatusRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'new_status' in body &&
    typeof (body as StatusRequestBody).new_status === 'string' &&
    (body as StatusRequestBody).new_status.length > 0
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
      return NextResponse.json({ error: 'Missing or invalid new_status field' }, { status: 400 });
    }

    const { new_status } = body;
    if (!(CASE_STATUS as readonly string[]).includes(new_status)) {
      return NextResponse.json(
        { error: `Invalid status: '${new_status}'. Must be one of: ${CASE_STATUS.join(', ')}` },
        { status: 400 },
      );
    }

    let updated;
    try {
      updated = await m(api.caseStatus.transitionMine, {
        caseId: caseId as Id<'cases'>,
        newStatus: new_status,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Not found')) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      }
      if (msg.startsWith('INVALID_TRANSITION') || msg.startsWith('INVALID_STATUS')) {
        return NextResponse.json({ error: `Invalid status transition. ${msg}` }, { status: 400 });
      }
      throw err;
    }

    /* ---- Schedule / cancel outcome emails (BullMQ side-effect) ---- */
    try {
      if (new_status === 'sent') {
        const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
        await scheduleOutcomeEmails(caseId, user.email ?? '', appUrl);
      } else if (new_status === 'resolved' || new_status === 'closed') {
        await cancelOutcomeEmails(caseId);
      }
    } catch (emailErr) {
      // eslint-disable-next-line no-console
      console.error('Failed to schedule/cancel outcome emails:', emailErr);
    }

    return NextResponse.json({ case: updated.case });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/status error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
