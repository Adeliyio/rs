import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';

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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
