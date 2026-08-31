import { getAuthConfigProvider } from '@convex-dev/better-auth/auth-config';
import type { AuthConfig } from 'convex/server';

/**
 * Better Auth JWT provider configuration (STATIC JWKS).
 *
 * The Convex backend must know how to verify the session JWTs Better Auth
 * mints. Instead of discovering the JWKS over the backend's own public URL
 * (which failed on self-hosted Coolify — AuthProviderDiscoveryFailed), we bake
 * a STATIC JWKS into the JWKS env var and hand it straight to the provider. The
 * backend never fetches its own URL.
 *
 * BOOTSTRAP: on the very FIRST deploy the JWKS does not exist yet — it is
 * generated FROM a deployed backend (`auth:generateJwk`). So we only pass `jwks`
 * when it is present AND valid JSON; otherwise we fall back to the library's
 * URL-discovery default just long enough to complete that first deploy. Once you
 * run
 *   npx convex run auth:generateJwk | npx convex env set JWKS
 * the static key takes over on the next deploy. An invalid/partial JWKS value is
 * ignored (rather than throwing at module load and failing the whole push).
 */
function validJwks(): string | undefined {
  const raw = process.env.JWKS;
  if (!raw) return undefined;
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    return undefined;
  }
}

export default {
  providers: [getAuthConfigProvider({ jwks: validJwks() })],
} satisfies AuthConfig;
