/**
 * Convex Auth JWT provider configuration.
 *
 * Convex Auth signs its own session JWTs and must declare itself as a trusted
 * provider here — WITHOUT this file (plus the JWT_PRIVATE_KEY and JWKS env vars
 * on the Convex deployment), signUp/signIn fail with a 400 because the backend
 * cannot mint or verify a session token.
 *
 * `domain` is the deployment's own HTTP-actions origin, provided automatically
 * by the backend as CONVEX_SITE_URL (self-hosted: the :3211 origin, e.g.
 * https://convex-site.resolvaio.com). `applicationID: 'convex'` is the fixed id
 * Convex Auth uses for its issued tokens.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
