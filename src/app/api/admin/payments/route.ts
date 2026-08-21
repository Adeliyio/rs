/**
 * GET /api/admin/payments — List payment transactions from webhook_events.
 * POST /api/admin/payments — Issue a refund via Paddle API.
 *
 * Admin-only endpoints. Requires ADMIN_EMAILS.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';
import type { Id } from '@convex/dataModel';

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
  })) as Array<{
    _id: string;
    eventId: string;
    provider: string;
    payload: { event_type?: string; data?: Record<string, unknown> } | null;
    processedAt?: number;
    createdAt: number;
  }>;

  // `payload` is stored as a jsonb object (not a string).
  const payments = rows
    .filter((e) => e.payload?.event_type?.startsWith('transaction.'))
    .map((e) => {
      const payload = e.payload!;
      const data = (payload.data ?? {}) as {
        id?: string;
        total?: string;
        currency_code?: string;
        status?: string;
        customer_id?: string;
      };
      return {
        id: e._id,
        event_id: e.eventId,
        event_type: payload.event_type,
        transaction_id: data.id,
        amount: data.total ?? '0',
        currency: data.currency_code ?? 'USD',
        status: data.status ?? 'unknown',
        customer_id: data.customer_id,
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
  transaction_id: string;
  reason?: string;
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

  if (!body.transaction_id) {
    return NextResponse.json(
      { error: 'Missing transaction_id' },
      { status: 400 },
    );
  }

  // SEC-09: Validate transaction ID format before passing to Paddle API.
  // Paddle transaction IDs follow the pattern: txn_<alphanumeric>
  if (!/^txn_[a-zA-Z0-9]+$/.test(body.transaction_id)) {
    return NextResponse.json(
      { error: 'Invalid transaction_id format. Expected: txn_<alphanumeric>' },
      { status: 400 },
    );
  }

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Paddle API key not configured' },
      { status: 503 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'production'
      ? 'https://api.paddle.com'
      : 'https://sandbox-api.paddle.com';

  try {
    const response = await fetch(
      `${baseUrl}/transactions/${body.transaction_id}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: body.reason ?? 'Admin-initiated refund',
          type: 'full',
        }),
      },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: { message?: string } };
      return NextResponse.json(
        { error: data.error?.message ?? `Paddle error: ${response.status}` },
        { status: response.status },
      );
    }

    // Log the admin action to audit_log
    const convex = createServiceConvexClient();
    await convex.mutation(api.service.insertAudit, {
      secret: serviceSecret(),
      userId: auth.userId as Id<'users'>,
      correlationId: `admin-refund-${body.transaction_id}`,
      modelVersion: 'admin',
      promptVersion: 'refund',
      citationValidationResult: {
        action: 'refund',
        transaction_id: body.transaction_id,
        reason: body.reason ?? 'Admin-initiated refund',
        admin_email: auth.email,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction_id: body.transaction_id,
      message: 'Refund initiated successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
