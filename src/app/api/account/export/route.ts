/**
 * GET /api/account/export — GDPR/CCPA data export as JSON.
 *
 * Gathers all of the user's data via account.exportMine (ownership inherent),
 * then decrypts PII in diagnostic_state.answers before returning plaintext.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import { decryptAnswersPii } from '@/lib/crypto';
import type { DiagnosticState } from '@/types/diagnostic.types';
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await q(api.account.exportMine, {});

    // Decrypt PII in diagnostic_state.answers (export must be readable plaintext).
    const decryptedCases = data.cases.map((caseRow: Record<string, unknown>) => {
      const diagnosticState = caseRow.diagnostic_state as DiagnosticState | null;
      if (diagnosticState?.answers) {
        return {
          ...caseRow,
          diagnostic_state: {
            ...diagnosticState,
            answers: decryptAnswersPii(diagnosticState.answers),
          },
        };
      }
      return caseRow;
    });

    const exportData = {
      exported_at: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      cases: decryptedCases,
      documents: data.documents,
      letters: data.letters,
      sequences: data.sequences,
      packets: data.packets,
      deadline_events: data.deadline_events,
      outcomes: data.outcomes,
      subscriptions: data.subscriptions,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="resolvaio-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
