/**
 * GET /api/admin/payments — List payment events from webhook_events.
 * POST /api/admin/payments — Issue a refund via the Polar API.
 *
 * Admin-only endpoints. Requires ADMIN_EMAILS.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { getPolar } from '@/lib/payments/polar-client';
import { api } from '@convex/api';
import type { Id } from '@convex/dataModel';
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  GET — List payment events                                         */
/* ------------------------------------------------------------------ */

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === 'Unauthorized' ? 401 : 403 },
    );
  }

  // SEC-14: Audit log admin access
  void logAdminAction({ userId: auth.userId!, email: auth.email!, action: 'view_payments', ip: auth.ip });

  const convex = createServiceConvexClient();
  const rows = (await convex.query(api.service.listRecentWebhooks, {
    secret: serviceSecret(),
    limit: 100,
  })) as {
    _id: string;
    eventId: string;
    provider: string;
    payload: { type?: string; data?: Record<string, unknown> } | null;
    processedAt?: number;
    createdAt: number;
  }[];

  // `payload` is stored as a jsonb object (not a string). Polar events use a
  // top-level `type` (e.g. "order.paid") and camelCase `data`.
  const payments = rows
    .filter((e) => e.payload?.type?.startsWith('order.'))
    .map((e) => {
      const payload = e.payload!;
      const data = (payload.data ?? {}) as {
        id?: string;
        totalAmount?: number;
        currency?: string;
        status?: string;
        customerId?: string;
      };
      return {
        id: e._id,
        event_id: e.eventId,
        event_type: payload.type,
        order_id: data.id,
        // Polar amounts are integer cents.
        amount: typeof data.totalAmount === 'number' ? data.totalAmount : 0,
        currency: (data.currency ?? 'usd').toUpperCase(),
        status: data.status ?? 'unknown',
        customer_id: data.customerId,
        processed: !!e.processedAt,
        created_at: new Date(e.createdAt).toISOString(),
      };
    });

  return NextResponse.json({ payments });
}

/* ------------------------------------------------------------------ */
/*  POST — Issue a refund                                             */
/* ------------------------------------------------------------------ */

interface RefundRequestBody {
  order_id: string;
  reason?: string;
}

/**
 * Loose validation for a Polar order id: non-empty, reasonable length, and only
 * URL-safe id characters (Polar ids are UUID-like, e.g.
 * "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"). We deliberately do NOT over-constrain
 * to a specific prefix/format.
 */
function isPlausibleOrderId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 8 &&
    id.length <= 100 &&
    /^[A-Za-z0-9_-]+$/.test(id)
  );
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === 'Unauthorized' ? 401 : 403 },
    );
  }

  let body: RefundRequestBody;
  try {
    body = (await request.json()) as RefundRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.order_id) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  }

  // SEC-09: Validate the order id format loosely before passing to the Polar API.
  if (!isPlausibleOrderId(body.order_id)) {
    return NextResponse.json(
      { error: 'Invalid order_id format' },
      { status: 400 },
    );
  }

  if (!process.env.POLAR_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'Polar access token not configured' },
      { status: 503 },
    );
  }

  try {
    const polar = getPolar();

    // Polar refunds require an explicit amount (integer cents). Look up the
    // order's still-refundable amount and issue a full refund of it.
    const order = await polar.orders.get({ id: body.order_id });
    const amount = order.refundableAmount || order.totalAmount;
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Order has no refundable amount' },
        { status: 400 },
      );
    }

    await polar.refunds.create({
      orderId: body.order_id,
      amount,
      reason: 'customer_request',
      comment: body.reason ?? 'Admin-initiated refund',
      revokeBenefits: true,
    });

    // Log the admin action to audit_log
    const convex = createServiceConvexClient();
    await convex.mutation(api.service.insertAudit, {
      secret: serviceSecret(),
      userId: auth.userId as Id<'users'>,
      correlationId: `admin-refund-${body.order_id}`,
      modelVersion: 'admin',
      promptVersion: 'refund',
      citationValidationResult: {
        action: 'refund',
        order_id: body.order_id,
        reason: body.reason ?? 'Admin-initiated refund',
        admin_email: auth.email,
      },
    });

    return NextResponse.json({
      ok: true,
      order_id: body.order_id,
      message: 'Refund initiated successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund failed';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
