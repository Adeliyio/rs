/**
 * Payment gate — server-only.
 *
 * Verifies that a user has paid before allowing generation.
 * Checks both one-time purchases (via case.payment_status) and
 * active subscriptions (via subscriptions table).
 *
 * Rules:
 * - Subscription wedge: always free (no payment required)
 * - Deposit wedge: requires payment_status === 'paid' OR active subscription
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface PaymentGateResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks if the user has paid for the given case.
 *
 * @param supabase  Authenticated Supabase client (with user session).
 * @param caseId  The case to check.
 * @param wedge  The case wedge type.
 * @param paymentStatus  The case's current payment_status.
 * @param userId  The authenticated user's ID.
 */
export async function checkPaymentGate(
  supabase: SupabaseClient<Database>,
  _caseId: string,
  wedge: string,
  paymentStatus: string,
  userId: string,
): Promise<PaymentGateResult> {
  // Subscription wedge is always free
  if (wedge === 'subscription') {
    return { allowed: true };
  }

  // Check if the case itself has been paid for (one-time purchase)
  if (paymentStatus === 'paid') {
    return { allowed: true };
  }

  // Check if user has an active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, status, current_period_end')
    .eq('user_id', userId)
    .in('status', ['active'])
    .limit(1)
    .single();

  if (subscription) {
    // Verify subscription hasn't expired
    const sub = subscription as unknown as { id: string; status: string; current_period_end: string | null };
    const periodEnd = sub.current_period_end;
    if (periodEnd && new Date(periodEnd) > new Date()) {
      return { allowed: true };
    }
  }

  return {
    allowed: false,
    reason: 'Payment required before letter generation.',
  };
}
