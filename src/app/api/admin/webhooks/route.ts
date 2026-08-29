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

    void logAdminAction({ userId: auth.userId!, email: auth.email!, action: 'view_webhooks', ip: auth.ip });

    const convex = createServiceConvexClient();
    const rows = await convex.query(api.service.listRecentWebhooks, { secret: serviceSecret(), limit: 50 });

    const events = rows.map((w: Record<string, unknown>) => ({
      id: w._id,
      event_id: w.eventId,
      provider: w.provider,
      processed_at: w.processedAt ? new Date(w.processedAt as number).toISOString() : null,
      created_at: new Date(w.createdAt as number).toISOString(),
    }));

    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
