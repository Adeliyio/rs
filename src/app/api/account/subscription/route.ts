/**
 * GET /api/account/subscription — the current user's active subscription (or null).
 * Scoped to the caller inside subscriptions.currentMine.
 */

import { NextResponse } from 'next/server';

import { q, currentUser, api } from '@/lib/convex/server';
// Calls Convex — never cache (Next 14 caches GET route handlers by default).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sub = await q(api.subscriptions.currentMine, {});
    if (!sub) {
      return NextResponse.json({ subscription: null });
    }

    return NextResponse.json({
      subscription: {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        paddle_subscription_id: sub.paddle_subscription_id,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        created_at: sub.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
