/**
 * POST /api/cases/[id]/outcome
 * GET  /api/cases/[id]/outcome
 *
 * Records and retrieves case outcomes. Includes optional testimonial
 * with consent and identity level selection.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* ------------------------------------------------------------------ */
/*  GET — retrieve outcome                                            */
/* ------------------------------------------------------------------ */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('outcomes')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (error || !data) {
      return NextResponse.json({ outcome: null });
    }

    return NextResponse.json({ outcome: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  POST — record outcome                                             */
/* ------------------------------------------------------------------ */

interface OutcomeBody {
  outcome_category: 'full_recovery' | 'partial_recovery' | 'no_recovery' | 'pending';
  stage: 'sent' | 'response_received' | 'resolved' | 'closed';
  recovered_amount?: number;
  testimonial?: string;
  consent?: {
    share_outcome: boolean;
    share_testimonial: boolean;
    identity_level: 'full' | 'first_city' | 'anonymous';
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify case ownership
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const body = (await request.json()) as OutcomeBody;

    if (!body.outcome_category || !body.stage) {
      return NextResponse.json(
        { error: 'Missing outcome_category or stage' },
        { status: 400 },
      );
    }

    const outcomePayload: Record<string, unknown> = {
      case_id: caseId,
      stage: body.stage,
      outcome_category: body.outcome_category,
      recovered_amount: body.recovered_amount ?? null,
      testimonial: body.testimonial ?? null,
      consent: body.consent ?? null,
      outcome_verified: false,
    };

    // Upsert — one outcome per case
    const { data: outcomeData, error: insertError } = await supabase
      .from('outcomes')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
      .upsert(outcomePayload, { onConflict: 'case_id' })
      .select()
      .single();

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error('Failed to save outcome:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to save outcome. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ outcome: outcomeData });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
