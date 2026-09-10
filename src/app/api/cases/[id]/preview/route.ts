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
import { normalizeDepositAnswers } from '@/features/deposit/generation/normalize-answers';
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
    // NORMALIZE FIRST. The diagnostic engine keys answers by NODE ID, so the
    // amount the visitor typed lands under 'deposit_amount';
    // 'original_deposit_amount' is a DERIVED key that only exists after
    // normalizeDepositAnswers runs. Reading it raw always yielded undefined,
    // and the old `?? 0` turned that into a hard "$0" — rendered three times on
    // the very screen that asks the customer for $49.
    // The three other consumers of this key (generate route, packet route,
    // generation worker) all normalize before reading; this route was the
    // outlier.
    // No context needed here: we only read the deposit amount, and the optional
    // `userName` fill affects tenant_name, which this preview does not render.
    const normalizedAnswers = normalizeDepositAnswers(decryptedAnswers);
    const rawDepositAmount = normalizedAnswers['original_deposit_amount'];
    // Prefer "unknown" over a fabricated zero: a missing amount must never be
    // presented to the customer as a real $0 deposit.
    const depositAmount =
      typeof rawDepositAmount === 'number' && rawDepositAmount > 0
        ? rawDepositAmount
        : null;

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
