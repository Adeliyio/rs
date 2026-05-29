/**
 * GET  /api/admin/monitor-alerts — list law monitor alerts with pagination.
 * POST /api/admin/monitor-alerts — acknowledge or dismiss an alert.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

// Tables not yet in generated types — cast through unknown.
// Remove after running `supabase gen types`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): SupabaseClient<any, 'public', any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
  return createServiceRoleClient() as any;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.error === 'Unauthorized' ? 401 : 403 },
      );
    }

    void logAdminAction({
      userId: auth.userId!,
      email: auth.email!,
      action: 'view_monitor_alerts',
      ip: auth.ip,
    });

    const supabase = db();

    // Query params
    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get('status'); // 'new' | 'acknowledged' | 'dismissed'
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

    let query = supabase
      .from('statute_monitor_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch latest run info
    const { data: latestRun } = await supabase
      .from('statute_monitor_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // Count unacknowledged alerts
    const { count: unacknowledgedCount } = await supabase
      .from('statute_monitor_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new');

    return NextResponse.json({
      alerts: data ?? [],
      latest_run: latestRun ?? null,
      unacknowledged_count: unacknowledgedCount ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.error === 'Unauthorized' ? 401 : 403 },
      );
    }

    const body = (await request.json()) as {
      alert_id: string;
      action: 'acknowledge' | 'dismiss';
      dismiss_reason?: string;
    };

    if (!body.alert_id || !body.action) {
      return NextResponse.json({ error: 'alert_id and action are required' }, { status: 400 });
    }

    if (body.action !== 'acknowledge' && body.action !== 'dismiss') {
      return NextResponse.json({ error: 'action must be acknowledge or dismiss' }, { status: 400 });
    }

    void logAdminAction({
      userId: auth.userId!,
      email: auth.email!,
      action: `monitor_alert_${body.action}`,
      details: { alert_id: body.alert_id, dismiss_reason: body.dismiss_reason },
      ip: auth.ip,
    });

    const supabase = db();

    const updatePayload: Record<string, unknown> = {
      status: body.action === 'acknowledge' ? 'acknowledged' : 'dismissed',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: auth.email,
    };

    if (body.action === 'dismiss' && body.dismiss_reason) {
      updatePayload['dismiss_reason'] = body.dismiss_reason;
    }

    const { error } = await supabase
      .from('statute_monitor_alerts')
      .update(updatePayload)
      .eq('id', body.alert_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
