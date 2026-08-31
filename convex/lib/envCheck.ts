/**
 * Convex-backend environment validation.
 *
 * The Next.js app validates its own env (src/lib/env.ts), but NOTHING validated
 * the CONVEX-deployment env vars — which is exactly why the earlier auth outage
 * showed up as a masked 400 instead of a one-line diagnosis. This asserts the
 * Better Auth vars exist and throws naming the specific missing var(s).
 *
 * Call `assertConvexEnv()` (or hit the /health/env route) after deploy so a
 * misconfigured deployment fails loudly instead of returning 400s on first login.
 */

/** Vars the Convex backend must have for auth + core features to work. */
const REQUIRED_CONVEX_ENV = [
  'BETTER_AUTH_SECRET', // Better Auth signing/session secret
  'JWKS', // static JWKS the backend verifies session tokens with (no self-URL discovery)
  'SITE_URL', // auth base URL (the PUBLIC APP origin, e.g. https://app.resolvaio.com)
  'AUTH_RESEND_KEY', // OTP verification/reset email sender
  'CONVEX_SERVICE_SECRET', // trusted server→Convex calls
] as const;

export interface EnvCheckResult {
  ok: boolean;
  missing: string[];
}

/** Returns which required Convex env vars are missing (does not throw). */
export function checkConvexEnv(): EnvCheckResult {
  const missing = REQUIRED_CONVEX_ENV.filter(
    (name) => !process.env[name] || process.env[name]!.trim().length === 0,
  );
  return { ok: missing.length === 0, missing };
}

/** Throws a clear, var-naming error if any required Convex env var is missing. */
export function assertConvexEnv(): void {
  const { ok, missing } = checkConvexEnv();
  if (!ok) {
    throw new Error(
      `[convex-env] Missing required Convex deployment env var(s): ${missing.join(', ')}. ` +
        `Set them on the CONVEX BACKEND with 'npx convex env set NAME value' — NOT in Coolify. ` +
        `SITE_URL is the public app origin. JWKS is the static key doc from 'npx convex run auth:generateJwk'.`,
    );
  }
}
