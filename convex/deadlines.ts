import { v } from 'convex/values';
import { query, internalQuery, internalMutation } from './_generated/server';
import { requireCaseOwner } from './lib/authz';
import { serializeDeadlineEvent } from './lib/serialize';

/**
 * Deadline events. Ownership via parent case for user reads. The scheduler and
 * the deadline-check cron use the internal functions (formerly service-role).
 */

export const listByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('deadlineEvents')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows
      .sort((a, b) => b.deadlineDate - a.deadlineDate)
      .map(serializeDeadlineEvent);
  },
});

export const latestByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('deadlineEvents')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    const latest = rows.sort((a, b) => b.deadlineDate - a.deadlineDate)[0];
    return latest ? serializeDeadlineEvent(latest) : null;
  },
});

/* ---- internal (scheduler + cron) ---- */

export const listByCaseInternal = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const rows = await ctx.db
      .query('deadlineEvents')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.map(serializeDeadlineEvent);
  },
});

/** Insert a deadline event (scheduler handles its own dedup upstream). */
export const createInternal = internalMutation({
  args: {
    caseId: v.id('cases'),
    deadlineDate: v.number(),
    timezone: v.string(),
    anchorEvent: v.string(),
    promptMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('deadlineEvents', {
      caseId: args.caseId,
      deadlineDate: args.deadlineDate,
      timezone: args.timezone,
      anchorEvent: args.anchorEvent,
      promptMessage: args.promptMessage,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const markFiredInternal = internalMutation({
  args: { deadlineEventId: v.id('deadlineEvents') },
  handler: async (ctx, { deadlineEventId }) => {
    await ctx.db.patch(deadlineEventId, { firedAt: Date.now() });
  },
});

/**
 * Due deadlines: unfired, undismissed, deadlineDate <= now. Ordered ascending,
 * capped at 100 — mirrors getDueDeadlines() in the old scheduler.
 */
export const getDueInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query('deadlineEvents')
      .withIndex('by_deadline_date', (q) => q.lte('deadlineDate', now))
      .collect();
    return rows
      .filter((d) => d.firedAt === undefined && d.dismissedAt === undefined)
      .sort((a, b) => a.deadlineDate - b.deadlineDate)
      .slice(0, 100)
      .map(serializeDeadlineEvent);
  },
});

/** Count unfired deadlines with a future date (admin stats "upcoming"). */
export const countUpcomingInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query('deadlineEvents').collect();
    return rows.filter((d) => d.firedAt === undefined && d.deadlineDate >= now).length;
  },
});
