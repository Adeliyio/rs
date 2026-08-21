import { v } from 'convex/values';
import { internalQuery, internalMutation } from './_generated/server';

/**
 * Statute monitor runs + alerts. Service-role/admin-only under Supabase → all
 * internal. Admin API routes gate access via requireAdmin() (Next side) and
 * then call these internal functions.
 */

/* ---- runs ---- */

export const createRunInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return ctx.db.insert('statuteMonitorRuns', {
      startedAt: now,
      statutesChecked: 0,
      changesDetected: 0,
      status: 'running',
      createdAt: now,
    });
  },
});

export const finishRunInternal = internalMutation({
  args: {
    runId: v.id('statuteMonitorRuns'),
    statutesChecked: v.number(),
    changesDetected: v.number(),
    status: v.union(v.literal('completed'), v.literal('failed')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { runId, statutesChecked, changesDetected, status, error }) => {
    await ctx.db.patch(runId, {
      completedAt: Date.now(),
      statutesChecked,
      changesDetected,
      status,
      error,
    });
  },
});

export const listRunsInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return ctx.db
      .query('statuteMonitorRuns')
      .withIndex('by_status_started')
      .order('desc')
      .take(limit ?? 20);
  },
});

/* ---- alerts ---- */

/** Has a non-dismissed alert for this statute been created within `sinceMs`? */
export const isRecentlyAlertedInternal = internalQuery({
  args: { statuteId: v.string(), sinceMs: v.number() },
  handler: async (ctx, { statuteId, sinceMs }) => {
    const rows = await ctx.db
      .query('statuteMonitorAlerts')
      .withIndex('by_statute_created', (q) => q.eq('statuteId', statuteId))
      .collect();
    return rows.some((a) => a.status !== 'dismissed' && a.createdAt >= sinceMs);
  },
});

export const createAlertInternal = internalMutation({
  args: {
    runId: v.id('statuteMonitorRuns'),
    statuteId: v.string(),
    citation: v.string(),
    jurisdiction: v.string(),
    kbEntryId: v.string(),
    changeSummary: v.string(),
    changeDetails: v.any(),
    severity: v.union(v.literal('info'), v.literal('warning'), v.literal('critical')),
    confidence: v.number(),
    sourceUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('statuteMonitorAlerts', {
      ...args,
      status: 'new',
      createdAt: Date.now(),
    });
  },
});

export const listAlertsInternal = internalQuery({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { status, limit }) => {
    let rows;
    if (status) {
      rows = await ctx.db
        .query('statuteMonitorAlerts')
        .withIndex('by_status', (q) => q.eq('status', status as 'new' | 'acknowledged' | 'dismissed'))
        .collect();
    } else {
      rows = await ctx.db.query('statuteMonitorAlerts').collect();
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit ?? 100);
  },
});

export const countAlertsByStatusInternal = internalQuery({
  args: { status: v.string() },
  handler: async (ctx, { status }) => {
    const rows = await ctx.db
      .query('statuteMonitorAlerts')
      .withIndex('by_status', (q) => q.eq('status', status as 'new' | 'acknowledged' | 'dismissed'))
      .collect();
    return rows.length;
  },
});

export const updateAlertStatusInternal = internalMutation({
  args: {
    alertId: v.id('statuteMonitorAlerts'),
    status: v.union(v.literal('acknowledged'), v.literal('dismissed')),
    acknowledgedBy: v.optional(v.string()),
    dismissReason: v.optional(v.string()),
  },
  handler: async (ctx, { alertId, status, acknowledgedBy, dismissReason }) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'acknowledged') {
      patch.acknowledgedAt = Date.now();
      patch.acknowledgedBy = acknowledgedBy;
    }
    if (status === 'dismissed') patch.dismissReason = dismissReason;
    await ctx.db.patch(alertId, patch);
  },
});
