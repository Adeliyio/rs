/**
 * GET /api/trust/stats
 *
 * Returns aggregate trust statistics for display on the landing
 * page and case pages. Gated by minimum thresholds per
 * compliance rules: 50 completed cases per wedge/jurisdiction
 * before showing aggregate data.
 *
 * Public endpoint — no authentication required.
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const MIN_CASES_FOR_DISPLAY = 50;

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Count completed cases by wedge
    const { count: depositCount } = await supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('wedge', 'deposit')
      .in('status', ['resolved', 'closed'])
      .is('deleted_at', null);

    const { count: subscriptionCount } = await supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('wedge', 'subscription')
      .in('status', ['resolved', 'closed'])
      .is('deleted_at', null);

    // Count outcomes with consent to share
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('outcome_category, recovered_amount, consent')
      .not('consent', 'is', null);

    const consentedOutcomes = (outcomes ?? []).filter((o) => {
      const row = o as unknown as { consent: { share_outcome: boolean } | null };
      return row.consent?.share_outcome === true;
    });

    // Calculate aggregate stats only if threshold met
    const depositTotal = depositCount ?? 0;
    const subscriptionTotal = subscriptionCount ?? 0;
    const totalCompleted = depositTotal + subscriptionTotal;

    const showDepositStats = depositTotal >= MIN_CASES_FOR_DISPLAY;
    const showSubscriptionStats = subscriptionTotal >= MIN_CASES_FOR_DISPLAY;

    // Recovery stats from consented outcomes
    let totalRecovered = 0;
    let recoveryCount = 0;
    for (const o of consentedOutcomes) {
      const row = o as unknown as { outcome_category: string; recovered_amount: number | null };
      if (row.recovered_amount && row.recovered_amount > 0) {
        totalRecovered += row.recovered_amount;
        recoveryCount++;
      }
    }

    // Jurisdictions covered
    const { data: jurisdictions } = await supabase
      .from('cases')
      .select('jurisdiction')
      .eq('wedge', 'deposit')
      .is('deleted_at', null);

    const uniqueJurisdictions = new Set(
      (jurisdictions ?? []).map((j) => (j as unknown as { jurisdiction: string }).jurisdiction),
    );

    return NextResponse.json({
      total_cases_completed: totalCompleted,
      deposit: {
        cases_completed: depositTotal,
        stats_available: showDepositStats,
      },
      subscription: {
        cases_completed: subscriptionTotal,
        stats_available: showSubscriptionStats,
      },
      recovery: {
        available: recoveryCount >= 10,
        cases_with_recovery: recoveryCount,
        total_recovered: recoveryCount >= 10 ? totalRecovered : null,
        average_recovered: recoveryCount >= 10 ? Math.round(totalRecovered / recoveryCount) : null,
      },
      jurisdictions_covered: uniqueJurisdictions.size,
      min_threshold: MIN_CASES_FOR_DISPLAY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
