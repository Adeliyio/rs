/**
 * GET /api/admin/stats
 * Admin-only stats endpoint. Uses service-role client.
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'Unauthorized' ? 401 : 403 });
    }

    // SEC-14: Audit log admin access
    void logAdminAction({ userId: auth.userId!, email: auth.email!, action: 'view_stats', ip: auth.ip });

    const supabase = createServiceRoleClient();

    const { count: totalCases } = await supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { data: statusCounts } = await supabase
      .from('cases')
      .select('status')
      .is('deleted_at', null);

    const { data: wedgeCounts } = await supabase
      .from('cases')
      .select('wedge')
      .is('deleted_at', null);

    const { count: recentGenerations } = await supabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const { count: pendingDeadlines } = await supabase
      .from('deadline_events')
      .select('id', { count: 'exact', head: true })
      .is('fired_at', null)
      .is('dismissed_at', null);

    const { count: failedWebhooks } = await supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .is('processed_at', null);

    // Aggregate status counts
    const casesByStatus: Record<string, number> = {};
    for (const c of statusCounts ?? []) {
      const row = c as unknown as { status: string };
      casesByStatus[row.status] = (casesByStatus[row.status] ?? 0) + 1;
    }

    const casesByWedge: Record<string, number> = {};
    for (const c of wedgeCounts ?? []) {
      const row = c as unknown as { wedge: string };
      casesByWedge[row.wedge] = (casesByWedge[row.wedge] ?? 0) + 1;
    }

    return NextResponse.json({
      total_cases: totalCases ?? 0,
      cases_by_status: casesByStatus,
      cases_by_wedge: casesByWedge,
      recent_generations: recentGenerations ?? 0,
      pending_deadlines: pendingDeadlines ?? 0,
      failed_webhooks: failedWebhooks ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
