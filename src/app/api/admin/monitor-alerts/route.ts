/**
 * GET  /api/admin/monitor-alerts — list law monitor alerts.
 * POST /api/admin/monitor-alerts — acknowledge or dismiss an alert.
 *
 * Admin-gated (requireAdmin). Data via the service-gated lawMonitor functions.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';
import type { Id } from '@convex/dataModel';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'Unauthorized' ? 401 : 403 });
    }

    void logAdminAction({ userId: auth.userId!, email: auth.email!, action: 'view_monitor_alerts', ip: auth.ip });

    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get('status') ?? undefined;
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

    const convex = createServiceConvexClient();
    const secret = serviceSecret();

    const [alerts, runs, unacknowledgedCount] = await Promise.all([
      convex.query(api.service.listAlerts, { secret, status: statusFilter, limit }),
      convex.query(api.service.listMonitorRuns, { secret, limit: 1 }),
      convex.query(api.service.countAlertsByStatus, { secret, status: 'new' }),
    ]);

    return NextResponse.json({
      alerts,
      latest_run: runs[0] ?? null,
      unacknowledged_count: unacknowledgedCount,
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
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'Unauthorized' ? 401 : 403 });
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

    const convex = createServiceConvexClient();
    await convex.mutation(api.service.updateAlertStatus, {
      secret: serviceSecret(),
      alertId: body.alert_id as Id<'statuteMonitorAlerts'>,
      status: body.action === 'acknowledge' ? 'acknowledged' : 'dismissed',
      acknowledgedBy: auth.email,
      dismissReason: body.action === 'dismiss' ? body.dismiss_reason : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
