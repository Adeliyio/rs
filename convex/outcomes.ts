import { v } from 'convex/values';
import { query, mutation, internalQuery } from './_generated/server';
import { requireCaseOwner } from './lib/authz';
import { serializeOutcome } from './lib/serialize';

/**
 * Outcomes (one per case — the SQL UNIQUE(case_id) is enforced here via the
 * by_case index + get-then-insert/patch upsert, replacing Supabase
 * .upsert({ onConflict: 'case_id' })).
 */

export const getByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const existing = await ctx.db
      .query('outcomes')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .unique();
    return existing ? serializeOutcome(existing) : null;
  },
});

/** Upsert the outcome for an owned case. */
export const upsertMine = mutation({
  args: {
    caseId: v.id('cases'),
    stage: v.string(),
    outcomeCategory: v.string(),
    recoveredAmount: v.optional(v.number()),
    testimonial: v.optional(v.string()),
    consent: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireCaseOwner(ctx, args.caseId);
    const now = Date.now();
    const existing = await ctx.db
      .query('outcomes')
      .withIndex('by_case', (q) => q.eq('caseId', args.caseId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stage: args.stage,
        outcomeCategory: args.outcomeCategory,
        recoveredAmount: args.recoveredAmount,
        testimonial: args.testimonial,
        consent: args.consent,
        updatedAt: now,
      });
      const doc = await ctx.db.get(existing._id);
      return serializeOutcome(doc!);
    }

    const id = await ctx.db.insert('outcomes', {
      caseId: args.caseId,
      stage: args.stage,
      outcomeCategory: args.outcomeCategory,
      recoveredAmount: args.recoveredAmount,
      testimonial: args.testimonial,
      consent: args.consent,
      outcomeVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return serializeOutcome(doc!);
  },
});

/** Verified outcomes for the public trust/stats aggregation. */
export const listVerifiedInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('outcomes').collect();
    return rows.filter((o) => o.outcomeVerified).map(serializeOutcome);
  },
});

export const listByCaseInternal = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const rows = await ctx.db
      .query('outcomes')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.map(serializeOutcome);
  },
});
