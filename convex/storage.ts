import { v } from 'convex/values';
import { action, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { getAuthUserId } from '@convex-dev/auth/server';

/**
 * User-facing R2 storage actions (authenticated).
 *
 * These are called from authenticated Next.js routes (with the user's token).
 * Because actions cannot use ctx.db, ownership is enforced by requiring that
 * every object key begins with the caller's own user id — the key convention is
 * `{userId}/{caseId}/{filename}`, so a user can only ever address their own
 * namespace. This reproduces the tenant isolation the storage path gave us
 * under Supabase, without needing a DB read inside the action.
 *
 * The actual R2 I/O runs in the internal actions in storageActions.ts.
 */

async function assertOwnsKey(ctx: ActionCtx, key: string): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthorized');
  if (!key.startsWith(`${userId}/`)) {
    throw new Error('Forbidden: key outside your namespace');
  }
  return userId;
}

/** Upload bytes to R2 under the caller's own {userId}/... namespace. */
export const upload = action({
  args: { key: v.string(), bytes: v.bytes(), contentType: v.optional(v.string()) },
  handler: async (ctx, { key, bytes, contentType }): Promise<string> => {
    await assertOwnsKey(ctx, key);
    return ctx.runAction(internal.storageActions.uploadInternal, { key, bytes, contentType });
  },
});

/** Signed download URL for a key in the caller's own namespace. */
export const signedUrl = action({
  args: {
    key: v.string(),
    ttl: v.optional(v.union(v.literal('internal'), v.literal('userFacing'))),
  },
  handler: async (ctx, { key, ttl }): Promise<string> => {
    await assertOwnsKey(ctx, key);
    return ctx.runAction(internal.storageActions.signInternal, { key, ttl });
  },
});
