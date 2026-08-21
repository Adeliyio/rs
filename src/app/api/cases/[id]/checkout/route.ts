/**
 * POST /api/cases/[id]/checkout
 *
 * Links a Paddle transaction to a case after checkout so the webhook can match
 * transaction.completed events. Does NOT mark as paid (webhook does that).
 * Ownership via cases.getMine / cases.updateMine.
 */

import { NextResponse } from 'next/server';

import { q, m, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { assignPriceVariant } from '@/lib/pricing/ab-pricing';
import { DEPOSIT_JURISDICTION } from '@/types/enums';
import type { Id } from '@convex/dataModel';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: caseId } = await params;

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { transaction_id?: string };
    const transactionId = body.transaction_id;
    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json({ error: 'Missing transaction_id' }, { status: 400 });
    }

    const caseRow = await q(api.cases.getMine, { caseId: caseId as Id<'cases'> });
    if (!caseRow) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (caseRow.paddle_transaction_id) {
      return NextResponse.json({ ok: true, already_linked: true });
    }

    if (
      caseRow.wedge === 'deposit' &&
      !DEPOSIT_JURISDICTION.includes(caseRow.jurisdiction as (typeof DEPOSIT_JURISDICTION)[number])
    ) {
      return NextResponse.json(
        {
          error: 'This jurisdiction is not supported for deposit cases. A refund will be issued.',
          auto_refund: true,
        },
        { status: 422 },
      );
    }

    await m(api.cases.updateMine, {
      caseId: caseId as Id<'cases'>,
      patch: { paddleTransactionId: transactionId },
    });

    /* ---- Log A/B price variant (best-effort) ---- */
    try {
      const variant = assignPriceVariant(caseId);
      const convex = createServiceConvexClient();
      await convex.mutation(api.service.insertAudit, {
        secret: serviceSecret(),
        caseId: caseId as Id<'cases'>,
        userId: user.id as Id<'users'>,
        correlationId: `checkout-${transactionId}`,
        modelVersion: 'pricing',
        promptVersion: 'ab_test_v1',
        citationValidationResult: {
          action: 'checkout',
          price_variant_amount: variant.amount,
          price_variant_label: variant.label,
          price_id: variant.priceId,
          transaction_id: transactionId,
        },
      });
    } catch {
      // non-critical
    }

    return NextResponse.json({ ok: true, transaction_id: transactionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/cases/[id]/checkout error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
