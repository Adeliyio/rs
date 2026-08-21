/**
 * GET /api/trust/stats — public aggregate trust statistics.
 *
 * Gated by minimum thresholds per compliance rules (50 completed cases per
 * wedge before showing aggregate data). The aggregate runs server-side via the
 * service-gated Convex query.
 */

import { NextResponse } from 'next/server';

import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';

const MIN_CASES_FOR_DISPLAY = 50;

export async function GET() {
  try {
    const convex = createServiceConvexClient();
    const s = await convex.query(api.service.trustStats, { secret: serviceSecret() });

    const depositTotal = s.depositCompleted;
    const subscriptionTotal = s.subscriptionCompleted;
    const totalCompleted = depositTotal + subscriptionTotal;
    const recoveryCount = s.recoveryCount;
    const totalRecovered = s.totalRecovered;

    return NextResponse.json({
      total_cases_completed: totalCompleted,
      deposit: {
        cases_completed: depositTotal,
        stats_available: depositTotal >= MIN_CASES_FOR_DISPLAY,
      },
      subscription: {
        cases_completed: subscriptionTotal,
        stats_available: subscriptionTotal >= MIN_CASES_FOR_DISPLAY,
      },
      recovery: {
        available: recoveryCount >= 10,
        cases_with_recovery: recoveryCount,
        total_recovered: recoveryCount >= 10 ? totalRecovered : null,
        average_recovered: recoveryCount >= 10 ? Math.round(totalRecovered / recoveryCount) : null,
      },
      jurisdictions_covered: s.jurisdictionsCovered,
      min_threshold: MIN_CASES_FOR_DISPLAY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
