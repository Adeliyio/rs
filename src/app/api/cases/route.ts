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
  jurisdiction: string;
}

function isValidCreateBody(body: unknown): body is CreateCaseBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'wedge' in body &&
    typeof (body as CreateCaseBody).wedge === 'string' &&
    'jurisdiction' in body &&
    typeof (body as CreateCaseBody).jurisdiction === 'string'
  );
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
    return NextResponse.json({ error: message }, { status: 500 });
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

    const result = await m(api.cases.create, {
      wedge: wedge as 'deposit' | 'subscription',
      jurisdiction,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
