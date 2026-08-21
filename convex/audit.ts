import { v } from 'convex/values';
import { internalQuery, internalMutation } from './_generated/server';

/**
 * Audit log. Append-only, service-role-only under Supabase (no user policies).
 * All internal here. The former `correlation_id` UNIQUE constraint is enforced
 * via the by_correlation index (idempotent inserts).
 */

export const insertInternal = internalMutation({
  args: {
    caseId: v.optional(v.id('cases')),
    userId: v.optional(v.id('users')),
    correlationId: v.optional(v.string()),
    generationInputsHash: v.optional(v.string()),
    groundingContextIds: v.optional(v.array(v.string())),
    modelVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    citationValidationResult: v.optional(v.any()),
    aiCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.correlationId) {
      const dup = await ctx.db
        .query('auditLog')
        .withIndex('by_correlation', (q) => q.eq('correlationId', args.correlationId))
        .unique();
      if (dup) return dup._id; // idempotent
    }
    return ctx.db.insert('auditLog', { ...args, createdAt: Date.now() });
  },
});

/** Most-recent audit rows (admin audit-logs view), newest first, limited. */
export const listRecentInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query('auditLog')
      .withIndex('by_created_at')
      .order('desc')
      .take(limit ?? 50);
    return rows;
  },
});

export const countAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('auditLog').collect();
    return rows.length;
  },
});
