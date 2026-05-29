/**
 * Subscription abuse soft cap — server-only.
 *
 * Prevents unlimited-plan abuse by checking how many active cases
 * a subscription user has. Per payment-billing-rules.md:
 * - 20 active cases: soft warning (allow with note)
 * - 25 active cases: hard block (deny creation)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const SOFT_CAP = 20;
const HARD_CAP = 25;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AbuseCapResult {
  allowed: boolean;
  warning: boolean;
  active_count: number;
  message?: string;
}

/* ------------------------------------------------------------------ */
/*  Main check                                                        */
/* ------------------------------------------------------------------ */

/**
 * Checks if a subscription user has exceeded the active case cap.
 *
 * Only applies to users with active subscriptions. One-time purchases
 * are not subject to this check.
 *
 * @param supabase  Authenticated Supabase client.
 * @param userId  The user's ID.
 * @returns  Whether the user can create a new case.
 */
export async function checkAbuseCap(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AbuseCapResult> {
  // Check if user has an active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['active'])
    .limit(1)
    .single();

  // Not a subscription user — no cap applies
  if (!subscription) {
    return { allowed: true, warning: false, active_count: 0 };
  }

  // Count active (non-closed, non-resolved) cases
  const { count, error } = await supabase
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .not('status', 'in', '("closed","resolved")');

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[AbuseCap] Failed to count cases:', error.message);
    // Fail open — allow the request
    return { allowed: true, warning: false, active_count: 0 };
  }

  const activeCount = count ?? 0;

  if (activeCount >= HARD_CAP) {
    return {
      allowed: false,
      warning: false,
      active_count: activeCount,
      message: `You have ${activeCount} active cases. Please resolve or close some existing cases before creating new ones. The maximum for subscription accounts is ${HARD_CAP} active cases.`,
    };
  }

  if (activeCount >= SOFT_CAP) {
    return {
      allowed: true,
      warning: true,
      active_count: activeCount,
      message: `You have ${activeCount} active cases. Consider resolving or closing completed cases. Subscription accounts are limited to ${HARD_CAP} active cases.`,
    };
  }

  return { allowed: true, warning: false, active_count: activeCount };
}

export { SOFT_CAP, HARD_CAP };
