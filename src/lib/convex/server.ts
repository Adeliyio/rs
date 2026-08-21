import 'server-only';

import { fetchQuery, fetchMutation, fetchAction } from 'convex/nextjs';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';

import { api } from '@convex/api';

/**
 * Server-side Convex helpers for Route Handlers and Server Components.
 *
 * Replaces `src/lib/supabase/server.ts`. Every call forwards the Convex Auth
 * session token (from the request cookies) so the function's `ctx.auth` resolves
 * the current user — the equivalent of the old cookie-based Supabase client.
 *
 * IMPORTANT (CSRF): Convex only allows QUERIES from GET route handlers / Server
 * Components. Mutations and actions must run from POST/PUT handlers or Server
 * Actions. The old code already used POST for all writes, so this holds.
 */

/** The current request's Convex Auth token, or undefined if unauthenticated. */
export async function authToken(): Promise<string | undefined> {
  return convexAuthNextjsToken();
}

/** Run a Convex query as the current user. */
export async function q<Query extends Parameters<typeof fetchQuery>[0]>(
  query: Query,
  args: Parameters<typeof fetchQuery<Query>>[1],
) {
  const token = await convexAuthNextjsToken();
  return fetchQuery(query, args, { token });
}

/** Run a Convex mutation as the current user (POST/Server Action only). */
export async function m<Mutation extends Parameters<typeof fetchMutation>[0]>(
  mutation: Mutation,
  args: Parameters<typeof fetchMutation<Mutation>>[1],
) {
  const token = await convexAuthNextjsToken();
  return fetchMutation(mutation, args, { token });
}

/** Run a Convex action as the current user (POST/Server Action only). */
export async function a<Action extends Parameters<typeof fetchAction>[0]>(
  action: Action,
  args: Parameters<typeof fetchAction<Action>>[1],
) {
  const token = await convexAuthNextjsToken();
  return fetchAction(action, args, { token });
}

/**
 * Resolve the current user (id + email) or null. Replaces the ubiquitous
 * `const { data: { user } } = await supabase.auth.getUser()` guard.
 */
export async function currentUser(): Promise<
  { id: string; email: string | null; name: string | null } | null
> {
  try {
    return await q(api.users.me, {});
  } catch {
    return null;
  }
}

export { api };
