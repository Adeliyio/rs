import { v } from 'convex/values';
import { internalQuery, internalMutation } from './_generated/server';

/**
 * Tavily search cache. Service-role-only under Supabase → all internal.
 * `queryHash` UNIQUE enforced via index. TTL is checked by the caller (it knows
 * CACHE_TTL_DAYS); we expose fetchedAt/expiresAt for that.
 */

export const getInternal = internalQuery({
  args: { queryHash: v.string() },
  handler: async (ctx, { queryHash }) => {
    const doc = await ctx.db
      .query('tavilyCache')
      .withIndex('by_query_hash', (q) => q.eq('queryHash', queryHash))
      .unique();
    if (!doc) return null;
    return {
      query_hash: doc.queryHash,
      results: doc.results,
      fetched_at: new Date(doc.fetchedAt).toISOString(),
      expires_at: new Date(doc.expiresAt).toISOString(),
    };
  },
});

export const deleteInternal = internalMutation({
  args: { queryHash: v.string() },
  handler: async (ctx, { queryHash }) => {
    const doc = await ctx.db
      .query('tavilyCache')
      .withIndex('by_query_hash', (q) => q.eq('queryHash', queryHash))
      .unique();
    if (doc) await ctx.db.delete(doc._id);
  },
});

/** Upsert by queryHash (replaces .upsert({ onConflict: 'query_hash' })). */
export const upsertInternal = internalMutation({
  args: {
    queryHash: v.string(),
    domainFilter: v.optional(v.string()),
    results: v.any(),
    ttlDays: v.number(),
  },
  handler: async (ctx, { queryHash, domainFilter, results, ttlDays }) => {
    const now = Date.now();
    const expiresAt = now + ttlDays * 24 * 60 * 60 * 1000;
    const existing = await ctx.db
      .query('tavilyCache')
      .withIndex('by_query_hash', (q) => q.eq('queryHash', queryHash))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        domainFilter,
        results,
        fetchedAt: now,
        expiresAt,
      });
      return existing._id;
    }
    return ctx.db.insert('tavilyCache', {
      queryHash,
      domainFilter,
      results,
      fetchedAt: now,
      expiresAt,
    });
  },
});
