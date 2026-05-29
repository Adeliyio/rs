/* eslint-disable @typescript-eslint/no-explicit-any -- Manual DB types cause any leakage; remove after pnpm db:gen-types */
/**
 * POST /api/cases/[id]/status
 *
 * Advances a case through the status state machine.
 *
 * Body: { new_status: string }
 *
 * Valid transitions (from database-schema-rules.md):
 *   intake             → generated
 *   generated          → sent
 *   sent               → awaiting
 *   awaiting           → escalation_drafted
 *   awaiting           → resolved
 *   escalation_drafted → resolved
 *   resolved           → closed
 *   ANY                → closed   (administrative closure)
 *
 * Rejects invalid transitions with a 400 error.
 * Creates a case_status_history entry on success.
 * RLS on the cases table enforces ownership.
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { scheduleOutcomeEmails, cancelOutcomeEmails } from '@/lib/outcomes/outcome-scheduler';
import { CASE_STATUS } from '@/types/enums';
import type { CaseStatus } from '@/types/enums';
import type { Tables } from '@/types/database.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type CaseRow = Pick<Tables<'cases'>, 'id' | 'status'>;

interface StatusRequestBody {
  new_status: string;
}

/* ------------------------------------------------------------------ */
/*  State machine                                                     */
/* ------------------------------------------------------------------ */

/**
 * Map from current status → set of valid next statuses.
 * "closed" is always valid from any state (administrative).
 */
const VALID_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  intake: ['generated', 'closed'],
  generated: ['sent', 'closed'],
  sent: ['awaiting', 'closed'],
  awaiting: ['escalation_drafted', 'resolved', 'closed'],
  escalation_drafted: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [], // terminal state — no outbound transitions
};

function isValidTransition(
  current: CaseStatus,
  next: CaseStatus,
): boolean {
  return VALID_TRANSITIONS[current].includes(next);
}

function isCaseStatus(value: string): value is CaseStatus {
  return (CASE_STATUS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

function isValidBody(body: unknown): body is StatusRequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'new_status' in body &&
    typeof (body as StatusRequestBody).new_status === 'string' &&
    (body as StatusRequestBody).new_status.length > 0
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
    const { id: caseId } = await params;

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
        { error: 'Missing or invalid new_status field' },
        { status: 400 },
      );
    }

    const { new_status } = body;

    if (!isCaseStatus(new_status)) {
      return NextResponse.json(
        { error: `Invalid status: '${new_status}'. Must be one of: ${CASE_STATUS.join(', ')}` },
        { status: 400 },
      );
    }

    /* ---- Fetch case (RLS ensures ownership) ---- */
    const { data, error: fetchError } = await supabase
      .from('cases')
      .select('id, status')
      .eq('id', caseId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 },
      );
    }

    const existingCase = data as unknown as CaseRow;
    const previousStatus = existingCase.status;

    /* ---- Validate transition ---- */
    if (!isValidTransition(previousStatus, new_status)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: '${previousStatus}' → '${new_status}'. Allowed transitions from '${previousStatus}': ${VALID_TRANSITIONS[previousStatus].join(', ') || 'none (terminal state)'}`,
        },
        { status: 400 },
      );
    }

    /* ---- Update case ---- */
    const updatePayload: Record<string, unknown> = {
      status: new_status,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedData, error: updateError } = await supabase
      .from('cases')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
      .update(updatePayload)
      .eq('id', caseId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update case status: ${updateError.message}` },
        { status: 500 },
      );
    }

    /* ---- Create status history entry ---- */
    const historyPayload: Record<string, unknown> = {
      case_id: caseId,
      previous_status: previousStatus,
      new_status,
    };

    const { error: historyError } = await supabase
      .from('case_status_history')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type from manual Database definition
      .insert(historyPayload);

    if (historyError) {
      // Non-critical — log but don't fail the request
      // eslint-disable-next-line no-console
      console.error(
        'Failed to create case_status_history entry:',
        historyError.message,
      );
    }

    /* ---- Schedule / cancel outcome emails ---- */
    try {
      if (new_status === 'sent') {
        const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
        await scheduleOutcomeEmails(caseId, user.email ?? '', appUrl);
      } else if (new_status === 'resolved' || new_status === 'closed') {
        await cancelOutcomeEmails(caseId);
      }
    } catch (emailErr) {
      // Non-critical — log but don't fail the status update
      // eslint-disable-next-line no-console
      console.error('Failed to schedule/cancel outcome emails:', emailErr);
    }

    return NextResponse.json({ case: updatedData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/status error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
