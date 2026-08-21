import { v } from 'convex/values';
import { query, internalQuery, internalMutation } from './_generated/server';
import { requireUser } from './lib/authz';
import { serializeSubscription } from './lib/serialize';

/**
 * Subscriptions. User-facing read is scoped to the current user. Writes happen
 * only in the Paddle webhook processor (internal), keyed by paddleSubscriptionId.
 */

/** The current user's most-recent active/past_due subscription (or null). */
export const currentMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const relevant = rows
      .filter((s) => s.status === 'active' || s.status === 'past_due')
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return relevant ? serializeSubscription(relevant) : null;
  },
});

/* ---- internal (webhook processor) ---- */

export const getByPaddleIdInternal = internalQuery({
  args: { paddleSubscriptionId: v.string() },
  handler: async (ctx, { paddleSubscriptionId }) => {
    const doc = await ctx.db
      .query('subscriptions')
      .withIndex('by_paddle_subscription_id', (q) =>
        q.eq('paddleSubscriptionId', paddleSubscriptionId),
      )
      .unique();
    return doc ? serializeSubscription(doc) : null;
  },
});

export const createInternal = internalMutation({
  args: {
    paddleCustomerId: v.optional(v.string()),
    paddleSubscriptionId: v.string(),
    plan: v.string(),
    status: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Idempotency: skip if it already exists.
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_paddle_subscription_id', (q) =>
        q.eq('paddleSubscriptionId', args.paddleSubscriptionId),
      )
      .unique();
    if (existing) return serializeSubscription(existing);

    const now = Date.now();
    const id = await ctx.db.insert('subscriptions', {
      paddleCustomerId: args.paddleCustomerId,
      paddleSubscriptionId: args.paddleSubscriptionId,
      plan: args.plan,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return serializeSubscription(doc!);
  },
});

export const patchByPaddleIdInternal = internalMutation({
  args: { paddleSubscriptionId: v.string(), patch: v.any() },
  handler: async (ctx, { paddleSubscriptionId, patch }) => {
    const doc = await ctx.db
      .query('subscriptions')
      .withIndex('by_paddle_subscription_id', (q) =>
        q.eq('paddleSubscriptionId', paddleSubscriptionId),
      )
      .unique();
    if (!doc) return null;
    await ctx.db.patch(doc._id, { ...patch, updatedAt: Date.now() });
    const updated = await ctx.db.get(doc._id);
    return updated ? serializeSubscription(updated) : null;
  },
});

export const listByUserInternal = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows.map(serializeSubscription);
  },
});

export const deleteByUserInternal = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
