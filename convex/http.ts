import { httpRouter } from 'convex/server';
import { auth } from './auth';

/**
 * HTTP router — wires Convex Auth's HTTP routes (OAuth callbacks, etc.).
 *
 * Self-hosted, HTTP actions are served on port 3211 by the Convex backend.
 * The Google OAuth redirect URI must point at this deployment's HTTP-actions
 * URL: `${CONVEX_SITE_URL}/api/auth/callback/google`.
 */
const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
