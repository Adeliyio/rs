/**
 * GET /api/admin/payments — List payment transactions from webhook_events.
 * POST /api/admin/payments — Issue a refund via Paddle API.
 *
 * Admin-only endpoints. Requires ADMIN_EMAILS.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

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

  const supabase = createServiceRoleClient();

  // Fetch transaction-related webhook events
  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch payments: ${error.message}` },
      { status: 500 },
    );
  }

  // Parse raw_payload to extract transaction details
  const payments = ((data ?? []) as unknown as {
    id: string;
    event_id: string;
    provider: string;
    raw_payload: string;
    processed_at: string | null;
    created_at: string;
  }[])
    .filter((e) => {
      try {
        const payload = JSON.parse(e.raw_payload) as { event_type?: string };
        return payload.event_type?.startsWith('transaction.');
      } catch {
        return false;
      }
    })
    .map((e) => {
      try {
        const payload = JSON.parse(e.raw_payload) as {
          event_type: string;
          data: {
            id: string;
            total?: string;
            currency_code?: string;
            status?: string;
            customer_id?: string;
          };
        };
        return {
          id: e.id,
          event_id: e.event_id,
          event_type: payload.event_type,
          transaction_id: payload.data.id,
          amount: payload.data.total ?? '0',
          currency: payload.data.currency_code ?? 'USD',
          status: payload.data.status ?? 'unknown',
          customer_id: payload.data.customer_id,
          processed: !!e.processed_at,
          created_at: e.created_at,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

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
    const supabase = createServiceRoleClient();
    const auditPayload: Record<string, unknown> = {
      user_id: auth.userId,
      correlation_id: `admin-refund-${body.transaction_id}`,
      model_version: 'admin',
      prompt_version: 'refund',
      citation_validation_result: {
        action: 'refund',
        transaction_id: body.transaction_id,
        reason: body.reason ?? 'Admin-initiated refund',
        admin_email: auth.email,
      },
    };
    // @ts-expect-error — service-role Supabase client resolves Insert generics as never
    await supabase.from('audit_log').insert(auditPayload);

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
