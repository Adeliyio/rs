/**
 * /api/cases — CRUD for cases (Convex).
 *
 * GET  — returns all cases for the authenticated user, newest updated first.
 * POST — creates a new case with status 'intake'.
 *
 * Ownership is enforced inside the Convex functions (cases.listMine /
 * cases.create) via the authz helpers — the RLS replacement.
 */

import { NextResponse } from 'next/server';

import { q, m, currentUser, api } from '@/lib/convex/server';
import { WEDGE, DEPOSIT_JURISDICTION } from '@/types/enums';
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const;

interface CreateCaseBody {
  wedge: string;
  /**
   * Optional. When the case is started from the dashboard "New Case" flow the
   * state is NOT collected up front — the diagnostic asks it as its first
   * question (avoiding the old double-ask). In that case jurisdiction is omitted
   * and the case is created with a PENDING_JURISDICTION sentinel, which the
   * diagnostic overwrites with the real state on the first answer (via the
   * saveDiagnosticState PUT). Deep-link / anonymous flows may still pass a
   * validated jurisdiction directly.
   */
  jurisdiction?: string;
}

/** Sentinel for a case whose state the diagnostic will collect on question 1. */
const PENDING_JURISDICTION = 'PENDING';

function isValidCreateBody(body: unknown): body is CreateCaseBody {
  if (typeof body !== 'object' || body === null || !('wedge' in body)) {
    return false;
  }
  const b = body as { wedge: unknown; jurisdiction?: unknown };
  if (typeof b.wedge !== 'string') return false;
  // jurisdiction is optional; if present it must be a string (validated below).
  if ('jurisdiction' in b && b.jurisdiction !== undefined && typeof b.jurisdiction !== 'string') {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  GET — list cases                                                  */
/* ------------------------------------------------------------------ */

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cases = await q(api.cases.listMine, {});
    // Preserve the old response subset shape.
    const shaped = cases.map((c) => ({
      id: c.id,
      wedge: c.wedge,
      jurisdiction: c.jurisdiction,
      status: c.status,
      updated_at: c.updated_at,
      created_at: c.created_at,
      refusal_trigger: c.refusal_trigger,
    }));
    return NextResponse.json({ cases: shaped });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create case                                                */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
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

    if (!isValidCreateBody(body)) {
      return NextResponse.json(
        { error: 'Missing or invalid wedge / jurisdiction fields' },
        { status: 400 },
      );
    }

    const { wedge, jurisdiction } = body;

    if (!(WEDGE as readonly string[]).includes(wedge)) {
      return NextResponse.json(
        { error: `Invalid wedge: '${wedge}'. Must be 'deposit' or 'subscription'.` },
        { status: 400 },
      );
    }

    // Jurisdiction is collected by the diagnostic's first question when omitted.
    // Only validate it when the caller actually supplied one (deep-link/anonymous
    // paths); an omitted state becomes the PENDING sentinel and is set later.
    let jurisdictionToUse: string = PENDING_JURISDICTION;
    if (jurisdiction !== undefined && jurisdiction !== '') {
      if (wedge === 'deposit') {
        if (!(DEPOSIT_JURISDICTION as readonly string[]).includes(jurisdiction)) {
          return NextResponse.json(
            { error: `Invalid jurisdiction for deposit: '${jurisdiction}'. Must be one of: ${DEPOSIT_JURISDICTION.join(', ')}` },
            { status: 400 },
          );
        }
      } else if (!(US_STATES as readonly string[]).includes(jurisdiction)) {
        return NextResponse.json(
          { error: `Invalid jurisdiction: '${jurisdiction}'. Must be a valid US state code.` },
          { status: 400 },
        );
      }
      jurisdictionToUse = jurisdiction;
    }

    const result = await m(api.cases.create, {
      wedge: wedge as 'deposit' | 'subscription',
      jurisdiction: jurisdictionToUse,
    });

    // Uniqueness guard (replaces the old 23505 / uq_active_case handling).
    if (result.duplicateOf) {
      return NextResponse.json(
        {
          error: 'You already have an active case for this type and state. Continue where you left off.',
          code: 'DUPLICATE_ACTIVE_CASE',
          existing_case_id: result.duplicateOf,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ case: result.case, id: result.case.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
