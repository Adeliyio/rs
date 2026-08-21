import { R2 } from '@convex-dev/r2';
import { components } from './_generated/api';

/**
 * Shared Cloudflare R2 client — replaces Supabase Storage (`documents` bucket).
 *
 * Object keys preserve the former path convention `{userId}/{caseId}/{filename}`
 * so tenant isolation and the account-deletion recursion carry over unchanged.
 *
 * Usage:
 * - `r2.store(actionCtx, bytes, { key, type })` → returns the key (upload).
 * - `r2.getUrl(key, { expiresIn })` → time-limited signed download URL.
 * - `r2.deleteObject(ctx, key)` → delete one object.
 *
 * NOTE: `store` requires an ActionCtx (it performs network I/O), so uploads
 * live in Convex actions, not mutations.
 *
 * Env vars (set on the Convex deployment):
 *   R2_TOKEN, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
 */
export const r2 = new R2(components.r2);

/** Signed-URL TTLs used across the app (seconds), mirroring the old code. */
export const SIGNED_URL_TTL = {
  internal: 5 * 60, // Vision extraction, internal packet fetch
  userFacing: 15 * 60, // letter / packet downloads returned to the client
} as const;
