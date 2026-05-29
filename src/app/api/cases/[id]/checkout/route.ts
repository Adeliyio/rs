/**
 * POST /api/cases/[id]/checkout
 *
 * Links a Paddle transaction to a case after successful checkout.
 * Called by the client after Paddle checkout completes.
 *
 * Sets case.paddle_transaction_id so the webhook handler can match
 * transaction.completed events to cases.
 *
 * Does NOT mark as paid — that happens via the webhook for security.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assignPriceVariant } from '@/lib/pricing/ab-pricing';
import { DEPOSIT_JURISDICTION } from '@/types/enums';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    /* ---- Auth ---- */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    /* ---- Parse body ---- */
    const body = (await request.json()) as { transaction_id?: string };
    const transactionId = body.transaction_id;

    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json(
        { error: 'Missing transaction_id' },
        { status: 400 },
      );
    }

    /* ---- Load case ---- */
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, user_id, wedge, jurisdiction, payment_status, paddle_transaction_id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const caseRow = caseData as unknown as {
      id: string;
      user_id: string;
      wedge: string;
      jurisdiction: string;
      payment_status: string;
      paddle_transaction_id: string | null;
    };

    /* ---- Already linked ---- */
    if (caseRow.paddle_transaction_id) {
      return NextResponse.json({ ok: true, already_linked: true });
    }

    /* ---- Unsupported jurisdiction check ---- */
    if (
      caseRow.wedge === 'deposit' &&
      !DEPOSIT_JURISDICTION.includes(
        caseRow.jurisdiction as (typeof DEPOSIT_JURISDICTION)[number],
      )
    ) {
      // Flag for auto-refund — webhook processor will handle
      return NextResponse.json(
        {
          error: 'This jurisdiction is not supported for deposit cases. A refund will be issued.',
          auto_refund: true,
        },
        { status: 422 },
      );
    }

    /* ---- Link transaction ---- */
    const { error: updateError } = await supabase
      .from('cases')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
      .update({
        paddle_transaction_id: transactionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', caseId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to link transaction: ${updateError.message}` },
        { status: 500 },
      );
    }

    /* ---- Log A/B price variant for analytics (best-effort) ---- */
    try {
      const variant = assignPriceVariant(caseId);
      const auditPayload: Record<string, unknown> = {
        case_id: caseId,
        user_id: user.id,
        correlation_id: `checkout-${transactionId}`,
        model_version: 'pricing',
        prompt_version: 'ab_test_v1',
        citation_validation_result: {
          action: 'checkout',
          price_variant_amount: variant.amount,
          price_variant_label: variant.label,
          price_id: variant.priceId,
          transaction_id: transactionId,
        },
      };
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type
      await supabase.from('audit_log').insert(auditPayload);
    } catch {
      // Non-critical — don't fail checkout
    }

    return NextResponse.json({ ok: true, transaction_id: transactionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/checkout error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
