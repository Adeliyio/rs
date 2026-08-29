import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { auth } from './auth';
import { checkConvexEnv } from './lib/envCheck';

/**
 * HTTP router — wires Convex Auth's HTTP routes (OAuth callbacks, etc.).
 *
 * Self-hosted, HTTP actions are served on port 3211 by the Convex backend.
 * The Google OAuth redirect URI must point at this deployment's HTTP-actions
 * URL: `${CONVEX_SITE_URL}/api/auth/callback/google`.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Env health check — surfaces missing Convex-deployment env vars so a
 * misconfigured deploy is a one-line diagnosis instead of a masked 400 on the
 * first login. Returns 200 {ok:true} when complete, 503 with the missing var
 * names otherwise. It does NOT reveal any values.
 */
http.route({
  path: '/health/env',
  method: 'GET',
  handler: httpAction(async () => {
    const { ok, missing } = checkConvexEnv();
    return new Response(JSON.stringify({ ok, missing }), {
      status: ok ? 200 : 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

export default http;
