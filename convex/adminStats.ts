import { internalQuery } from './_generated/server';

/**
 * Admin dashboard aggregate stats. Internal (called via service.adminStats,
 * gated by the service secret; the admin route also enforces requireAdmin +
 * IP allowlist on the Next.js side).
 *
 * Replaces the six separate count queries in /api/admin/stats with one pass.
 */
export const statsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cases = await ctx.db.query('cases').collect();
    const active = cases.filter((c) => c.deletedAt === undefined);

    const casesByStatus: Record<string, number> = {};
    const casesByWedge: Record<string, number> = {};
    for (const c of active) {
      casesByStatus[c.status] = (casesByStatus[c.status] ?? 0) + 1;
      casesByWedge[c.wedge] = (casesByWedge[c.wedge] ?? 0) + 1;
    }

    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const auditRows = await ctx.db.query('auditLog').collect();
    const recentGenerations = auditRows.filter((a) => a.createdAt >= weekAgo).length;

    const deadlines = await ctx.db.query('deadlineEvents').collect();
    const pendingDeadlines = deadlines.filter(
      (d) => d.firedAt === undefined && d.dismissedAt === undefined,
    ).length;

    const webhooks = await ctx.db.query('webhookEvents').collect();
    const failedWebhooks = webhooks.filter((w) => w.processedAt === undefined).length;

    return {
      total_cases: active.length,
      cases_by_status: casesByStatus,
      cases_by_wedge: casesByWedge,
      recent_generations: recentGenerations,
      pending_deadlines: pendingDeadlines,
      failed_webhooks: failedWebhooks,
    };
  },
});
