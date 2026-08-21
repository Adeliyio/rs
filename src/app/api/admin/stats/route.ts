/**
 * GET /api/admin/stats — admin-only dashboard stats.
 *
 * Admin gate: requireAdmin() (email allowlist + IP allowlist, Next side).
 * Data: the service-gated Convex aggregate query (single pass).
 */

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
      return NextResponse.json(
        { error: auth.error },
        { status: auth.error === 'Unauthorized' ? 401 : 403 },
      );
    }

    // SEC-14: audit admin access
    void logAdminAction({ userId: auth.userId!, email: auth.email!, action: 'view_stats', ip: auth.ip });

    const convex = createServiceConvexClient();
    const stats = await convex.query(api.service.adminStats, { secret: serviceSecret() });

    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
