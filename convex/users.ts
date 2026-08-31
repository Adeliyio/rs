import { v } from 'convex/values';
import { components } from './_generated/api';
import { query, internalQuery, internalMutation } from './_generated/server';
import { requireUser } from './lib/authz';

/**
 * Users. Our app `users` table is a thin MIRROR of the Better Auth component
 * user (written by the onCreate trigger in convex/auth.ts). These helpers
 * replace:
 * - `supabase.auth.getUser()` → `me` (current user for the app shell/settings)
 * - `supabase.auth.admin.getUserById(id)` → `emailByIdInternal` (workers/webhooks
 *   that need a user's email to send mail)
 * - `supabase.auth.admin.deleteUser(id)` → `deleteInternal` (GDPR account delete)
 */

/** Current authenticated user (id, email, name, createdAt) or null. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      created_at: new Date(user._creationTime).toISOString(),
    };
  },
});

/**
 * Resolve a user id by email — used to link a Polar subscription to its owner
 * when the checkout metadata didn't carry the userId. The Convex Auth `users`
 * table has no email index, so this filters; it runs only on the low-frequency
 * subscription.active webhook, so a scan is acceptable. Case-insensitive.
 */
export const userIdByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const target = email.trim().toLowerCase();
    if (!target) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', target))
      .first();
    return user?._id ?? null;
  },
});

/** Resolve a user's email by id (replaces auth.admin.getUserById → email). */
export const emailByIdInternal = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user?.email ?? null;
  },
});

export const getByIdInternal = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { id: user._id, email: user.email ?? null, name: user.name ?? null };
  },
});

/**
 * Delete the user completely (GDPR erasure — replaces auth.admin.deleteUser).
 *
 * Better Auth owns the user / session / account records INSIDE its component,
 * so we delete the component user via the component adapter (which cascades its
 * sessions/accounts), then remove our app mirror row. Deleting the component
 * user also fires the onDelete trigger in convex/auth.ts, which deletes the
 * mirror row too — that path is a guarded no-op, so the explicit delete here is
 * safe and idempotent whichever runs first.
 */
export const deleteInternal = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    // Remove the Better Auth component user linked to this app user. The `user`
    // model carries our app id in its `userId` field (set at sign-up). A single
    // app user maps to exactly one component user row, so one page (numItems well
    // above 1) drains the whole match — no continuation needed.
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: 'user',
        where: [{ field: 'userId', value: userId as string }],
      },
      paginationOpts: { cursor: null, numItems: 200 },
    });

    // Remove the app mirror row (the FK target for cases / subscriptions / …).
    const existing = await ctx.db.get(userId);
    if (existing) {
      await ctx.db.delete(userId);
    }
  },
});
