/**
 * GET /api/cases/[id]/deadlines
 * POST /api/cases/[id]/deadlines
 *
 * GET: Returns computed deadlines for a case based on KB rules and
 * diagnostic answers. Does not require deadlines to be scheduled.
 *
 * POST: Computes and schedules deadlines for a case. Creates
 * deadline_events records in the database.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import { decryptAnswersPii } from '@/lib/crypto';
import { computeDeadlines, getActionableDeadlines } from '@/lib/deadlines/calculator';
import { scheduleDeadlines } from '@/lib/deadlines/scheduler';
import { loadKbEntry } from '@/lib/kb/loader';
import { JURISDICTION_TIMEZONE } from '@/types/enums';
import type { DiagnosticState } from '@/types/diagnostic.types';
import type { DepositJurisdiction } from '@/types/enums';
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

    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const diagnosticState = caseRow.diagnostic_state as DiagnosticState | null;
    const answers = decryptAnswersPii(
      (diagnosticState?.answers ?? {}) as Record<string, unknown>,
    ) as Record<string, string | undefined>;

    // Load KB deadline rules
    let deadlineRules;
    try {
      const kbEntry = loadKbEntry(caseRow.wedge, caseRow.jurisdiction);
      deadlineRules = kbEntry.deadline_rules;
    } catch {
      return NextResponse.json({ deadlines: [], actionable: [] });
    }

    const timezone =
      JURISDICTION_TIMEZONE[caseRow.jurisdiction as DepositJurisdiction] ??
      'America/New_York';

    const { deadlines } = computeDeadlines(deadlineRules, answers, timezone);
    const actionable = getActionableDeadlines(deadlines);

    return NextResponse.json({
      deadlines: deadlines.map((d) => ({
        rule_id: d.rule_id,
        anchor_event: d.anchor_event,
        anchor_date: d.anchor_date.toISOString(),
        deadline_date: d.deadline_date.toISOString(),
        days_remaining: d.days_remaining,
        is_expired: d.is_expired,
        is_statutory: d.is_statutory,
        severity: d.severity,
        prompt_message: d.prompt_message,
        description: d.description,
      })),
      actionable: actionable.map((d) => ({
        rule_id: d.rule_id,
        deadline_date: d.deadline_date.toISOString(),
        days_remaining: d.days_remaining,
        severity: d.severity,
        prompt_message: d.prompt_message,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('GET /api/cases/[id]/deadlines error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postCaseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!postCaseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const postDiagnosticState = postCaseRow.diagnostic_state as DiagnosticState | null;
    const answers = decryptAnswersPii(
      (postDiagnosticState?.answers ?? {}) as Record<string, unknown>,
    ) as Record<string, string | undefined>;

    let deadlineRules;
    try {
      const kbEntry = loadKbEntry(postCaseRow.wedge, postCaseRow.jurisdiction);
      deadlineRules = kbEntry.deadline_rules;
    } catch {
      return NextResponse.json({
        scheduled: 0,
        skipped: 0,
        errors: ['No deadline rules found for this jurisdiction.'],
      });
    }

    const timezone =
      JURISDICTION_TIMEZONE[postCaseRow.jurisdiction as DepositJurisdiction] ??
      'America/New_York';

    const { deadlines } = computeDeadlines(deadlineRules, answers, timezone);
    const result = await scheduleDeadlines(caseId, deadlines, timezone);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/deadlines error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
