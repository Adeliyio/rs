'use client';

import type { ReactNode } from 'react';
import { ConvexReactClient } from 'convex/react';
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from '@convex-dev/better-auth/react';

import { authClient } from '@/lib/auth-client';
import { clientEnv } from '@/lib/env';

/**
 * Client-side Convex + Better Auth provider. Wraps the app so client components
 * can use useQuery()/useMutation() (authenticated with the current session) and
 * the auth flows in src/lib/convex/use-auth.ts.
 *
 * `initialToken` is read on the server (root layout) and passed in so the first
 * render is already authenticated — no unauthenticated flash before the client
 * fetches a token.
 */
const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      // The provider's `AuthClient` type and our concrete client (convexClient +
      // emailOTPClient plugins) are structurally identical at runtime, but Better
      // Auth's generic plugin inference makes the two invariant and non-assignable
      // to each other. Narrowing to the provider's own exported AuthClient type
      // reconciles them without changing any behaviour.
      authClient={authClient as unknown as AuthClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
