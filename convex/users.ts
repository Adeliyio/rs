import { v } from 'convex/values';
import { query, internalQuery, internalMutation } from './_generated/server';
import { requireUser } from './lib/authz';

/**
 * Users. Convex Auth owns the `users` table. These helpers replace:
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
 * Delete the auth user row and its linked auth records. Convex Auth stores
 * accounts/sessions in authAccounts/authSessions keyed by userId; we clear them
 * so the user is fully removed (replaces auth.admin.deleteUser).
 */
export const deleteInternal = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    // Remove linked auth accounts/sessions so the user is fully removed. These
    // tables come from authTables and index by userId.
    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (qb) => qb.eq('userId', userId))
      .collect();
    for (const acc of accounts) await ctx.db.delete(acc._id);

    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (qb) => qb.eq('userId', userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);

    await ctx.db.delete(userId);
  },
});
