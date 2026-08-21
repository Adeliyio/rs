import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'Unauthorized' ? 401 : 403 });
    }

    void logAdminAction({ userId: auth.userId!, email: auth.email!, action: 'view_audit_logs', ip: auth.ip });

    const convex = createServiceConvexClient();
    const logs = await convex.query(api.service.listRecentAudit, { secret: serviceSecret(), limit: 50 });

    return NextResponse.json({ logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
