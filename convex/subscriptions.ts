import { v } from 'convex/values';
import { query, internalQuery, internalMutation } from './_generated/server';
import { requireUser } from './lib/authz';
import { serializeSubscription } from './lib/serialize';

/**
 * Subscriptions. User-facing read is scoped to the current user. Writes happen
 * only in the Polar webhook processor (internal), keyed by polarSubscriptionId.
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

export const getByPolarIdInternal = internalQuery({
  args: { polarSubscriptionId: v.string() },
  handler: async (ctx, { polarSubscriptionId }) => {
    const doc = await ctx.db
      .query('subscriptions')
      .withIndex('by_polar_subscription_id', (q) =>
        q.eq('polarSubscriptionId', polarSubscriptionId),
      )
      .unique();
    return doc ? serializeSubscription(doc) : null;
  },
});

export const createInternal = internalMutation({
  args: {
    userId: v.optional(v.id('users')),
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.string(),
    plan: v.string(),
    status: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Idempotency: skip if it already exists — but if it exists WITHOUT a userId
    // and we now have one, backfill the link so entitlement starts working.
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_polar_subscription_id', (q) =>
        q.eq('polarSubscriptionId', args.polarSubscriptionId),
      )
      .unique();
    if (existing) {
      if (!existing.userId && args.userId) {
        await ctx.db.patch(existing._id, { userId: args.userId, updatedAt: Date.now() });
        const patched = await ctx.db.get(existing._id);
        return serializeSubscription(patched!);
      }
      return serializeSubscription(existing);
    }

    const now = Date.now();
    const id = await ctx.db.insert('subscriptions', {
      userId: args.userId,
      polarCustomerId: args.polarCustomerId,
      polarSubscriptionId: args.polarSubscriptionId,
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

export const patchByPolarIdInternal = internalMutation({
  args: { polarSubscriptionId: v.string(), patch: v.any() },
  handler: async (ctx, { polarSubscriptionId, patch }) => {
    const doc = await ctx.db
      .query('subscriptions')
      .withIndex('by_polar_subscription_id', (q) =>
        q.eq('polarSubscriptionId', polarSubscriptionId),
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

/**
 * Whether a user has an entitling (active/past_due) subscription. Mirrors the
 * `currentMine` filter but keyed by an explicit userId so trusted server code
 * (the generation worker, the PDF route) can check entitlement for the case
 * OWNER — currentMine is auth-scoped and unusable from the service client.
 */
export const hasActiveForUserInternal = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<boolean> => {
    const rows = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows.some((s) => s.status === 'active' || s.status === 'past_due');
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
