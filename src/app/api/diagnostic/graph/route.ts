/**
 * GET /api/diagnostic/graph?wedge=deposit|subscription
 *
 * PUBLIC — returns the diagnostic question graph for a wedge (SPEC.md M3). The
 * graph is a static, deterministic KB file (no per-user data), so the anonymous
 * value-first flow can render the questions in the browser with no account and
 * no case. Diagnostic answers are held in memory client-side until the visitor
 * reaches the value/cost boundary (email capture); nothing is persisted here.
 *
 * The authenticated GET /api/diagnostic/state (which also returns the graph) is
 * unchanged and still used once a case exists.
 */

import { NextResponse } from 'next/server';

import { loadDiagnosticGraph } from '@/lib/kb/loader';
import { WEDGE, type Wedge } from '@/types/enums';

export const dynamic = 'force-dynamic';

function isWedge(value: string): value is Wedge {
  return (WEDGE as readonly string[]).includes(value);
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const wedge = searchParams.get('wedge');

    if (!wedge || !isWedge(wedge)) {
      return NextResponse.json(
        { error: `Invalid or missing wedge. Expected one of: ${WEDGE.join(', ')}.` },
        { status: 400 },
      );
    }

    const graph = loadDiagnosticGraph(wedge);
    return NextResponse.json({ graph });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('GET /api/diagnostic/graph error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
