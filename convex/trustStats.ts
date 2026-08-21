import { internalQuery } from './_generated/server';

/**
 * Public trust-stats aggregate for the landing/case pages. Internal (called via
 * service.trustStats; the route is public but the aggregate runs server-side).
 *
 * Consolidates the several count/scan queries the old /api/trust/stats route ran.
 */
const COMPLETED = new Set(['resolved', 'closed']);

export const statsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cases = await ctx.db.query('cases').collect();
    const active = cases.filter((c) => c.deletedAt === undefined);

    const depositCompleted = active.filter(
      (c) => c.wedge === 'deposit' && COMPLETED.has(c.status),
    ).length;
    const subscriptionCompleted = active.filter(
      (c) => c.wedge === 'subscription' && COMPLETED.has(c.status),
    ).length;

    const depositJurisdictions = new Set(
      active.filter((c) => c.wedge === 'deposit').map((c) => c.jurisdiction),
    );

    const outcomes = await ctx.db.query('outcomes').collect();
    const consented = outcomes.filter(
      (o) => (o.consent as { share_outcome?: boolean } | null)?.share_outcome === true,
    );

    let totalRecovered = 0;
    let recoveryCount = 0;
    for (const o of consented) {
      if (o.recoveredAmount && o.recoveredAmount > 0) {
        totalRecovered += o.recoveredAmount;
        recoveryCount++;
      }
    }

    return {
      depositCompleted,
      subscriptionCompleted,
      jurisdictionsCovered: depositJurisdictions.size,
      totalRecovered,
      recoveryCount,
    };
  },
});
