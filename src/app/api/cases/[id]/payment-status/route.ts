/**
 * GET /api/cases/[id]/payment-status
 *
 * Lightweight endpoint for polling payment status during checkout.
 * Returns only the payment_status field to minimize data transfer.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data, error } = await supabase
      .from('cases')
      .select('payment_status')
      .eq('id', caseId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const row = data as unknown as { payment_status: string };
    return NextResponse.json({ payment_status: row.payment_status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
