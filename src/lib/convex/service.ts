import 'server-only';

import { ConvexHttpClient } from 'convex/browser';

import { clientEnv } from '@/lib/env';

/**
 * Service Convex client for TRUSTED server contexts that formerly used the
 * Supabase service-role key: the Paddle webhook processor, BullMQ workers, and
 * admin API routes.
 *
 * These call the `service.*` Convex functions, which are PUBLIC but gated by a
 * shared `CONVEX_SERVICE_SECRET`. This mirrors the old model where the
 * service-role key was the trust boundary — the secret must never reach the
 * browser. (Internal Convex functions can't be invoked directly over HTTP; the
 * service wrappers in convex/service.ts run them via ctx.runQuery/runMutation.)
 *
 * Workers run outside Next.js; they construct their own client from
 * NEXT_PUBLIC_CONVEX_URL + CONVEX_SERVICE_SECRET (see src/lib/convex/worker-client.ts).
 */
export function createServiceConvexClient(): ConvexHttpClient {
  const url = clientEnv.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set — cannot create service Convex client.');
  }
  return new ConvexHttpClient(url);
}

/** The shared service secret, read on the server only. */
export function serviceSecret(): string {
  const secret = process.env.CONVEX_SERVICE_SECRET;
  if (!secret) {
    throw new Error('CONVEX_SERVICE_SECRET is not set — trusted Convex operations are disabled.');
  }
  return secret;
}
