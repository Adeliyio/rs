/**
 * GET /api/account/export
 *
 * GDPR/CCPA data export — returns all user data as JSON.
 * Exports: cases, documents (metadata), letters, sequences,
 * packets, deadline_events, outcomes, subscriptions.
 *
 * Does NOT export: audit_log (system record), webhook_events (system).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptAnswersPii } from '@/lib/crypto';
import type { DiagnosticState } from '@/types/diagnostic.types';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Fetch all user data in parallel
    const [
      casesResult,
      documentsResult,
      lettersResult,
      sequencesResult,
      packetsResult,
      deadlinesResult,
      outcomesResult,
      subscriptionsResult,
    ] = await Promise.all([
      supabase.from('cases').select('*').eq('user_id', userId),
      supabase.from('documents').select('id, case_id, file_path, content_type, parse_status, created_at'),
      supabase.from('letters').select('*'),
      supabase.from('sequences').select('*'),
      supabase.from('packets').select('*'),
      supabase.from('deadline_events').select('*'),
      supabase.from('outcomes').select('*'),
      supabase.from('subscriptions').select('*').eq('user_id', userId),
    ]);

    // Decrypt PII in diagnostic_state.answers before exporting (GDPR export
    // must return readable plaintext, not encrypted blobs)
    const decryptedCases = (casesResult.data ?? []).map((caseRow) => {
      const row = caseRow as unknown as Record<string, unknown>;
      const diagnosticState = row.diagnostic_state as DiagnosticState | null;
      if (diagnosticState?.answers) {
        return {
          ...row,
          diagnostic_state: {
            ...diagnosticState,
            answers: decryptAnswersPii(diagnosticState.answers),
          },
        };
      }
      return row;
    });

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      cases: decryptedCases,
      documents: documentsResult.data ?? [],
      letters: lettersResult.data ?? [],
      sequences: sequencesResult.data ?? [],
      packets: packetsResult.data ?? [],
      deadline_events: deadlinesResult.data ?? [],
      outcomes: outcomesResult.data ?? [],
      subscriptions: subscriptionsResult.data ?? [],
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="resolvaio-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
