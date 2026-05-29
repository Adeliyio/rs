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
import { createClient } from '@/lib/supabase/server';
import { loadKbEntry } from '@/lib/kb/loader';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, wedge, jurisdiction, diagnostic_state')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const caseRow = caseData as unknown as {
      id: string;
      wedge: string;
      jurisdiction: string;
      diagnostic_state: Record<string, unknown> | null;
    };

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

    // Get deposit amount from diagnostic answers
    const diagnosticState = caseRow.diagnostic_state as {
      answers?: Record<string, unknown>;
    } | null;
    const depositAmount =
      (diagnosticState?.answers?.['original_deposit_amount'] as number) ?? 0;

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
