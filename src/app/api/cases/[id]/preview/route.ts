/**
 * GET /api/cases/[id]/preview
 *
 * Returns preview data for the letter paywall screen.
 * Loads KB entry for the case's jurisdiction and returns
 * statute count, deadline count, penalty availability,
 * and one sample statute for the preview — without generating
 * the full letter.
 *
 * No payment required — this is the conversion driver.
 */

import { NextResponse } from 'next/server';
import { q, currentUser, api } from '@/lib/convex/server';
import { decryptAnswersPii } from '@/lib/crypto';
import { loadKbEntry } from '@/lib/kb/loader';
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

    if (caseRow.wedge !== 'deposit') {
      return NextResponse.json(
        { error: 'Preview is only available for deposit cases.' },
        { status: 400 },
      );
    }

    // Load KB entry for jurisdiction
    let kbEntry;
    try {
      kbEntry = loadKbEntry('deposit', caseRow.jurisdiction);
    } catch {
      return NextResponse.json(
        { error: 'Jurisdiction not supported.' },
        { status: 400 },
      );
    }

    // Extract preview data
    const statutes = kbEntry.statutes ?? [];
    const deadlines = kbEntry.deadline_rules ?? [];
    const penalties = kbEntry.penalties ?? [];
    const sampleStatute = statutes[0];

    // Get deposit amount from diagnostic answers (decrypt PII fields)
    const diagnosticState = caseRow.diagnostic_state as {
      answers?: Record<string, unknown>;
    } | null;
    const decryptedAnswers = diagnosticState?.answers
      ? decryptAnswersPii(diagnosticState.answers)
      : {};
    const depositAmount =
      (decryptedAnswers['original_deposit_amount'] as number) ?? 0;

    const jurisdictionNames: Record<string, string> = {
      CA: 'California',
      TX: 'Texas',
      NY: 'New York',
      FL: 'Florida',
    };

    return NextResponse.json({
      jurisdiction: caseRow.jurisdiction,
      jurisdiction_full_name:
        jurisdictionNames[caseRow.jurisdiction] ?? caseRow.jurisdiction,
      deposit_amount: depositAmount,
      statute_count: statutes.length,
      deadline_count: deadlines.length,
      penalty_available: penalties.length > 0,
      sample_statute: sampleStatute
        ? {
            citation: sampleStatute.citation,
            title: sampleStatute.title,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('GET /api/cases/[id]/preview error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
