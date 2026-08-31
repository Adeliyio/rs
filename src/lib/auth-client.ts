import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

/**
 * Better Auth browser client — replaces @convex-dev/auth's useAuthActions.
 *
 * `convexClient()` makes the client talk to the Better Auth routes served by
 * the Convex deployment (registered in convex/http.ts), and keeps the Convex
 * session token in sync so `ConvexBetterAuthProvider` can authenticate reactive
 * queries. `emailOTPClient()` exposes the OTP verification/reset helpers used by
 * the sign-up and password-reset flows.
 *
 * The client infers its base URL from the current origin; the Next.js catch-all
 * route (src/app/api/auth/[...all]/route.ts) proxies to the Convex backend.
 */
export const authClient = createAuthClient({
  plugins: [convexClient(), emailOTPClient()],
});
