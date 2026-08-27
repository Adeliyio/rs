import { v } from 'convex/values';
import { internalQuery, internalMutation } from './_generated/server';

/**
 * Webhook events (Polar). Stored for idempotency + audit. Service-role-only
 * under Supabase → all internal here. `eventId` UNIQUE enforced via index.
 */

export const getByEventIdInternal = internalQuery({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    return ctx.db
      .query('webhookEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', eventId))
      .unique();
  },
});

/** Insert if new; returns { id, duplicate }. Idempotency guard for webhooks. */
export const recordInternal = internalMutation({
  args: { eventId: v.string(), provider: v.string(), payload: v.any() },
  handler: async (ctx, { eventId, provider, payload }) => {
    const existing = await ctx.db
      .query('webhookEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', eventId))
      .unique();
    if (existing) return { id: existing._id, duplicate: true };
    const id = await ctx.db.insert('webhookEvents', {
      eventId,
      provider,
      payload,
      createdAt: Date.now(),
    });
    return { id, duplicate: false };
  },
});

export const markProcessedInternal = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const doc = await ctx.db
      .query('webhookEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', eventId))
      .unique();
    if (doc) await ctx.db.patch(doc._id, { processedAt: Date.now() });
  },
});

export const listRecentInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return ctx.db
      .query('webhookEvents')
      .withIndex('by_created_at')
      .order('desc')
      .take(limit ?? 50);
  },
});

export const countAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('webhookEvents').collect();
    return rows.length;
  },
});

/**
 * Events that were stored (recordWebhook) but never marked processed — a handler
 * failed, or a transient Convex/Redis blip dropped the follow-up markProcessed.
 * The reprocessing worker replays these. We only return events older than
 * `olderThanMs` (default ~2 min) so we never race an in-flight webhook request
 * that is about to mark its own event processed. Oldest first, capped at `limit`.
 */
export const listUnprocessedInternal = internalQuery({
  args: { olderThanMs: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs, limit }) => {
    const cutoff = Date.now() - (olderThanMs ?? 2 * 60 * 1000);
    const rows = await ctx.db
      .query('webhookEvents')
      .withIndex('by_created_at', (q) => q.lte('createdAt', cutoff))
      .order('asc')
      .collect();
    return rows
      .filter((r) => r.processedAt === undefined || r.processedAt === null)
      .slice(0, limit ?? 50);
  },
});

/** Delete webhook events older than `olderThanMs`. Batched (default 100/run) to
 * keep each mutation transaction short. Returns the number deleted this run. */
export const deleteOldInternal = internalMutation({
  args: { olderThanMs: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs, limit }) => {
    const cutoff = Date.now() - olderThanMs;
    const rows = await ctx.db
      .query('webhookEvents')
      .withIndex('by_created_at', (q) => q.lte('createdAt', cutoff))
      .order('asc')
      .take(limit ?? 100);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return rows.length;
  },
});
