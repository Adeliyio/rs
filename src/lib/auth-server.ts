import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs';

/**
 * Server-side Better Auth helpers for Next.js (App Router).
 *
 * Replaces @convex-dev/auth's convexAuthNextjsToken/middleware server surface:
 * - `handler` backs the /api/auth/[...all] catch-all route (proxies auth
 *   requests to the Convex deployment's Better Auth routes).
 * - `getToken` returns the current Convex session token for authenticating
 *   server-side Convex calls (used by src/lib/convex/server.ts).
 * - `isAuthenticated` is the server gate used by src/middleware.ts.
 * - fetchAuthQuery/Mutation/Action run authenticated Convex functions on the
 *   server with the caller's session.
 *
 * convexUrl is the deployment's client origin (:3210); convexSiteUrl is its
 * HTTP-actions origin (:3211) where the Better Auth routes live.
 */
export const {
  handler,
  getToken,
  isAuthenticated,
  preloadAuthQuery,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});
