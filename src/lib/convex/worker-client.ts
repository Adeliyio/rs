import { ConvexHttpClient } from 'convex/browser';
import type {
  FunctionReference,
  FunctionArgs,
  FunctionReturnType,
} from 'convex/server';

import { api } from '@convex/api';

/**
 * Convex client for BullMQ workers (run outside Next.js, in a separate PM2
 * process). Workers are trusted contexts that formerly used the Supabase
 * service-role client; here they call the `service.*` Convex functions with the
 * shared CONVEX_SERVICE_SECRET.
 *
 * Reads NEXT_PUBLIC_CONVEX_URL + CONVEX_SERVICE_SECRET directly from process.env
 * (workers don't go through the app's env.ts client/server split).
 */

let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error('[worker] NEXT_PUBLIC_CONVEX_URL is not set.');
  }
  client = new ConvexHttpClient(url);
  return client;
}

function secret(): string {
  const s = process.env.CONVEX_SERVICE_SECRET;
  if (!s) throw new Error('[worker] CONVEX_SERVICE_SECRET is not set.');
  return s;
}

/**
 * Convenience wrappers so worker code reads cleanly. Each injects the service
 * secret. Example: `await workerConvex.query(api.service.getCase, { caseId })`.
 */
export const workerConvex = {
  query: <Q extends FunctionReference<'query'>>(
    fn: Q,
    args: Omit<FunctionArgs<Q>, 'secret'>,
  ): Promise<FunctionReturnType<Q>> =>
    getClient().query(fn, { ...args, secret: secret() } as FunctionArgs<Q>),

  mutation: <M extends FunctionReference<'mutation'>>(
    fn: M,
    args: Omit<FunctionArgs<M>, 'secret'>,
  ): Promise<FunctionReturnType<M>> =>
    getClient().mutation(fn, { ...args, secret: secret() } as FunctionArgs<M>),

  action: <A extends FunctionReference<'action'>>(
    fn: A,
    args: Omit<FunctionArgs<A>, 'secret'>,
  ): Promise<FunctionReturnType<A>> =>
    getClient().action(fn, { ...args, secret: secret() } as FunctionArgs<A>),
};

export { api };
