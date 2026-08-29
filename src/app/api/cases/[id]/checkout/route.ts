/**
 * POST /api/cases/[id]/checkout
 *
 * NOTE: Under Polar, case↔order linking is now WEBHOOK-DRIVEN — the checkout
 * metadata ({caseId}) is echoed on the `order.paid` webhook, which stores the
 * Polar order id on the case. This route's original job (linking a client-known
 * transaction id) is therefore largely superseded; it is kept for compatibility
 * and still records the A/B price variant. It does NOT mark as paid (webhook
 * does that). Ownership via cases.getMine / cases.updateMine.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { assignPriceVariant } from '@/lib/pricing/ab-pricing';
import { DEPOSIT_JURISDICTION } from '@/types/enums';
import type { Id } from '@convex/dataModel';

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

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

    if (caseRow.polar_order_id) {
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

    // polarOrderId is privileged (it links a case to a payment) and is no longer
    // owner-writable via updateMine — set it through the service-gated path.
    {
      const convex = createServiceConvexClient();
      await convex.mutation(api.service.patchCase, {
        secret: serviceSecret(),
        caseId: caseId as Id<'cases'>,
        patch: { polarOrderId: transactionId },
      });
    }

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
          product_id: variant.productId,
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
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
