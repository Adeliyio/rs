import { v } from 'convex/values';
import { mutation, internalMutation } from './_generated/server';
import { requireUser } from './lib/authz';

/**
 * Waitlist entries. Under Supabase, INSERT required any authenticated user
 * (RLS), and there were no user-facing reads (service-role only). We preserve
 * that: `join` requires auth; reads/deletes are internal.
 *
 * Enforces the former uq_waitlist_email_state_wedge unique constraint in app
 * code via the by_email_state_wedge index.
 */

export const join = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    state: v.string(),
    wedge: v.union(v.literal('deposit'), v.literal('subscription')),
  },
  handler: async (ctx, { email, name, state, wedge }) => {
    await requireUser(ctx); // matches RLS: auth.uid() IS NOT NULL

    const existing = await ctx.db
      .query('waitlistEntries')
      .withIndex('by_email_state_wedge', (q) =>
        q.eq('email', email).eq('state', state).eq('wedge', wedge),
      )
      .unique();
    if (existing) {
      return { id: existing._id, duplicate: true };
    }

    const id = await ctx.db.insert('waitlistEntries', {
      email,
      name,
      state,
      wedge,
      createdAt: Date.now(),
    });
    return { id, duplicate: false };
  },
});

export const deleteByEmailInternal = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const rows = await ctx.db
      .query('waitlistEntries')
      .withIndex('by_email', (q) => q.eq('email', email))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  },
});
