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

    void logAdminAction({ userId: auth.userId!, email: auth.email!, action: 'view_cases', ip: auth.ip });

    const convex = createServiceConvexClient();
    const allCases = await convex.query(api.service.listRecentCases, { secret: serviceSecret(), limit: 100 });

    // Preserve the old column subset.
    const cases = allCases.map((c: Record<string, unknown>) => ({
      id: c.id,
      user_id: c.user_id,
      wedge: c.wedge,
      jurisdiction: c.jurisdiction,
      status: c.status,
      payment_status: c.payment_status,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    return NextResponse.json({ cases });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
