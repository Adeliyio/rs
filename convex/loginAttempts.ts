import { v } from 'convex/values';
import { internalMutation } from './_generated/server';

/**
 * Login attempts — written by the auth rate limiter, kept for audit/abuse
 * analysis. Unbounded without a retention policy, so the daily cleanup cron
 * deletes attempts older than 30 days via `deleteOldInternal`.
 */

/** Delete login attempts older than `olderThanMs`. Batched (default 100/run) to
 * keep each mutation transaction short. Returns the number deleted this run. */
export const deleteOldInternal = internalMutation({
  args: { olderThanMs: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs, limit }) => {
    const cutoff = Date.now() - olderThanMs;
    const rows = await ctx.db
      .query('loginAttempts')
      .withIndex('by_attempted_at', (q) => q.lte('attemptedAt', cutoff))
      .order('asc')
      .take(limit ?? 100);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return rows.length;
  },
});
