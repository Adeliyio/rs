import 'server-only';

import { fetchQuery, fetchMutation, fetchAction } from 'convex/nextjs';
import { getToken } from '@/lib/auth-server';
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from 'convex/server';

import { api } from '@convex/api';

/**
 * Server-side Convex helpers for Route Handlers and Server Components.
 *
 * Replaces `src/lib/supabase/server.ts`. Every call forwards the Better Auth
 * session token (resolved from the request cookies by `getToken`) so the
 * function's `ctx.auth` resolves the current user — the equivalent of the old
 * cookie-based Supabase client.
 *
 * IMPORTANT (CSRF): Convex only allows QUERIES from GET route handlers / Server
 * Components. Mutations and actions must run from POST/PUT handlers or Server
 * Actions. The old code already used POST for all writes, so this holds.
 */

/** The current request's Better Auth token, or undefined if unauthenticated. */
export async function authToken(): Promise<string | undefined> {
  return getToken();
}

/** Run a Convex query as the current user. */
export async function q<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query>,
): Promise<FunctionReturnType<Query>> {
  const token = await getToken();
  return fetchQuery(query, args, { token });
}

/** Run a Convex mutation as the current user (POST/Server Action only). */
export async function m<Mutation extends FunctionReference<'mutation'>>(
  mutation: Mutation,
  args: FunctionArgs<Mutation>,
): Promise<FunctionReturnType<Mutation>> {
  const token = await getToken();
  return fetchMutation(mutation, args, { token });
}

/** Run a Convex action as the current user (POST/Server Action only). */
export async function a<Action extends FunctionReference<'action'>>(
  action: Action,
  args: FunctionArgs<Action>,
): Promise<FunctionReturnType<Action>> {
  const token = await getToken();
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
