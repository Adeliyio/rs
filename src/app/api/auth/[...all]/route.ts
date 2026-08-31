import { handler } from '@/lib/auth-server';

/**
 * Better Auth catch-all route.
 *
 * Every /api/auth/* request (sign-in, sign-up, OTP verify, OAuth callback,
 * token, sign-out) is proxied by this handler to the Better Auth routes served
 * by the Convex deployment. Replaces the former Convex Auth HTTP handling.
 */
export const { GET, POST } = handler;

// Auth requests are per-request; never statically cached.
export const dynamic = 'force-dynamic';
