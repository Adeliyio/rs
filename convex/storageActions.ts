'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { r2, SIGNED_URL_TTL } from './r2';

/**
 * INTERNAL R2 storage actions — the low-level upload/sign/delete primitives.
 *
 * These are internal so they can only be invoked from other Convex functions
 * (the service.* wrappers, which enforce CONVEX_SERVICE_SECRET) or from the
 * token-gated public wrappers in convex/storage.ts. Never callable directly by
 * the browser.
 *
 * Object keys preserve `{userId}/{caseId}/{filename}`. store/getUrl do network
 * I/O to R2, hence actions (not mutations).
 */

export const uploadInternal = internalAction({
  args: { key: v.string(), bytes: v.bytes(), contentType: v.optional(v.string()) },
  handler: async (ctx, { key, bytes, contentType }) => {
    return r2.store(ctx, new Uint8Array(bytes), { key, type: contentType });
  },
});

export const signInternal = internalAction({
  args: {
    key: v.string(),
    ttl: v.optional(v.union(v.literal('internal'), v.literal('userFacing'))),
  },
  handler: async (_ctx, { key, ttl }) => {
    const expiresIn = ttl === 'internal' ? SIGNED_URL_TTL.internal : SIGNED_URL_TTL.userFacing;
    return r2.getUrl(key, { expiresIn });
  },
});

export const removeInternal = internalAction({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, { keys }) => {
    for (const key of keys) {
      try {
        await r2.deleteObject(ctx, key);
      } catch {
        // best-effort — matches old storage.remove semantics
      }
    }
  },
});
