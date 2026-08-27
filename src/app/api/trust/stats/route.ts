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

// Scale-H4: this public endpoint aggregates ALL cases + ALL outcomes (two full
// table scans) on every hit — a crawler would hammer it. The result is coarse
// marketing data where 5-minute staleness is fine, so we cache it: `revalidate`
// makes Next serve a cached response for 5 minutes, and the Cache-Control header
// lets any CDN/edge in front do the same (with a stale-while-revalidate grace).
export const revalidate = 300;

const MIN_CASES_FOR_DISPLAY = 50;

/**
 * Shape of the service.trustStats result. The service wrapper is annotated
 * `Promise<any>` to break Convex's circular type inference (TS2589), so we
 * re-establish the concrete type at this boundary.
 */
interface TrustStats {
  depositCompleted: number;
  subscriptionCompleted: number;
  recoveryCount: number;
  totalRecovered: number;
  jurisdictionsCovered: number;
}

export async function GET(): Promise<NextResponse> {
  try {
    const convex = createServiceConvexClient();
    const s = (await convex.query(api.service.trustStats, {
      secret: serviceSecret(),
    })) as TrustStats;

    const depositTotal = s.depositCompleted;
    const subscriptionTotal = s.subscriptionCompleted;
    const totalCompleted = depositTotal + subscriptionTotal;
    const recoveryCount = s.recoveryCount;
    const totalRecovered = s.totalRecovered;

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // Do not let a transient error get cached in place of real stats.
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
