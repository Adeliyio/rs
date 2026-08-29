/**
 * Convex-backend environment validation.
 *
 * The Next.js app validates its own env (src/lib/env.ts), but NOTHING validated
 * the CONVEX-deployment env vars — which is exactly why the auth outage showed
 * up as a masked 400 (missing JWT_PRIVATE_KEY / JWKS / SITE_URL / CONVEX_SITE_URL
 * / AUTH_RESEND_KEY) instead of a one-line diagnosis. This asserts they exist and
 * throws naming the specific missing var(s).
 *
 * Call `assertConvexEnv()` from a function that runs after deploy (e.g. an HTTP
 * health route) so a misconfigured deployment fails loudly instead of silently
 * returning 400s on the first login.
 */

/** Vars the Convex backend must have for auth + core features to work. */
const REQUIRED_CONVEX_ENV = [
  'JWT_PRIVATE_KEY', // Convex Auth signs session tokens with this
  'JWKS', // …and verifies them with this
  'SITE_URL', // auth redirect base (the PUBLIC APP origin, e.g. https://app.resolvaio.com)
  'CONVEX_SITE_URL', // this deployment's HTTP-actions origin (auto-set on hosted; verify self-hosted)
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
        `Note SITE_URL is the public app origin and is DIFFERENT from CONVEX_SITE_URL.`,
    );
  }
}
