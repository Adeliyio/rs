/**
 * /api/cases — CRUD for cases.
 *
 * GET  — returns all cases for the authenticated user, ordered by updated_at desc.
 * POST — creates a new case with status 'intake'.
 *
 * RLS on the cases table enforces user ownership for all queries.
 */

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { WEDGE, DEPOSIT_JURISDICTION } from '@/types/enums';
import type { Wedge } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  US State codes for subscription jurisdiction validation           */
/* ------------------------------------------------------------------ */

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

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

    // RLS handles user filtering; we additionally filter deleted_at IS NULL
    const { data, error: fetchError } = await supabase
      .from('cases')
      .select(
        'id, wedge, jurisdiction, status, updated_at, created_at, refusal_trigger',
      )
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to load cases. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ cases: data ?? [] });
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

    if (!isValidCreateBody(body)) {
      return NextResponse.json(
        { error: 'Missing or invalid wedge / jurisdiction fields' },
        { status: 400 },
      );
    }

    const { wedge, jurisdiction } = body;

    /* ---- Validate wedge ---- */
    if (!(WEDGE as readonly string[]).includes(wedge)) {
      return NextResponse.json(
        { error: `Invalid wedge: '${wedge}'. Must be 'deposit' or 'subscription'.` },
        { status: 400 },
      );
    }

    /* ---- Validate jurisdiction ---- */
    if (wedge === 'deposit') {
      if (!(DEPOSIT_JURISDICTION as readonly string[]).includes(jurisdiction)) {
        return NextResponse.json(
          { error: `Invalid jurisdiction for deposit: '${jurisdiction}'. Must be one of: ${DEPOSIT_JURISDICTION.join(', ')}` },
          { status: 400 },
        );
      }
    } else {
      // subscription — any US state
      if (!(US_STATES as readonly string[]).includes(jurisdiction)) {
        return NextResponse.json(
          { error: `Invalid jurisdiction: '${jurisdiction}'. Must be a valid US state code.` },
          { status: 400 },
        );
      }
    }

    /* ---- Create case ---- */
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      wedge: wedge as Wedge,
      jurisdiction,
      status: 'intake',
      diagnostic_state: {},
      payment_status: 'pending',
      total_ai_cost: 0,
    };

    const { data: newCase, error: insertError } = await supabase
      .from('cases')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type from manual Database definition
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      // Unique constraint violation — user already has an active case for this wedge+jurisdiction
      if (
        insertError.code === '23505' ||
        insertError.message?.includes('uq_active_case') ||
        insertError.message?.includes('duplicate key')
      ) {
        // Find the existing active case so the client can redirect
        const { data: existingCase } = await supabase
          .from('cases')
          .select('id, wedge, jurisdiction, status')
          .eq('user_id', user.id)
          .eq('wedge', wedge)
          .eq('jurisdiction', jurisdiction)
          .not('status', 'in', '("resolved","closed")')
          .is('deleted_at', null)
          .limit(1)
          .single();

        const existingId = existingCase
          ? (existingCase as unknown as { id: string }).id
          : undefined;

        return NextResponse.json(
          {
            error: 'You already have an active case for this type and state. Continue where you left off.',
            code: 'DUPLICATE_ACTIVE_CASE',
            existing_case_id: existingId,
          },
          { status: 409 },
        );
      }

      // eslint-disable-next-line no-console
      console.error('Failed to create case:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to create case. Please try again.' },
        { status: 500 },
      );
    }

    const created = newCase as unknown as { id: string };

    return NextResponse.json({ case: newCase, id: created.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
