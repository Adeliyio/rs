/**
 * POST /api/admin/monitor-run — manually trigger a law monitor run.
 *
 * Accepts optional statute_ids array to scope the check.
 * Without it, all statutes in all KB entries are checked.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { enqueueLawMonitorRun } from '@/lib/queue/enqueue';

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
      statute_ids?: string[];
    };

    void logAdminAction({
      userId: auth.userId!,
      email: auth.email!,
      action: 'trigger_law_monitor_run',
      details: { statute_ids: body.statute_ids, run_type: 'manual' },
      ip: auth.ip,
    });

    const jobId = await enqueueLawMonitorRun({
      run_type: 'manual',
      statute_ids: body.statute_ids,
      triggered_by: auth.email,
    });

    return NextResponse.json({ ok: true, job_id: jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
