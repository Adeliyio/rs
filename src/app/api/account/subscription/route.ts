/**
 * GET /api/account/subscription
 *
 * Returns the current user's active subscription, if any.
 * Used by the settings page and subscription management UI.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ subscription: null });
    }

    const sub = data as unknown as {
      id: string;
      plan: string;
      status: string;
      paddle_subscription_id: string;
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
      created_at: string;
    };

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
