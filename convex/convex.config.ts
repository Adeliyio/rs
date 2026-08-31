import { defineApp } from 'convex/server';
import r2 from '@convex-dev/r2/convex.config.js';
import betterAuth from '@convex-dev/better-auth/convex.config';

/**
 * Convex app configuration.
 *
 * Registers two components:
 * - R2: Cloudflare R2 storage for the `documents` bucket (evidence uploads,
 *   letter PDFs, packet ZIPs). Credentials via R2_TOKEN, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET.
 * - Better Auth: authentication (email/password + OTP verification + Google
 *   OAuth), replacing @convex-dev/auth. The component owns its own user /
 *   session / account / jwks tables inside the component namespace; our app
 *   `users` table is a thin mirror linked via the onCreate trigger in
 *   convex/auth.ts. Env: BETTER_AUTH_SECRET, SITE_URL, JWKS, plus the OTP
 *   email + Google OAuth vars.
 */
const app = defineApp();
app.use(r2);
app.use(betterAuth);

export default app;
