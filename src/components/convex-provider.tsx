'use client';

import type { ReactNode } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs';

import { clientEnv } from '@/lib/env';

/**
 * Client-side Convex + Auth provider. Wraps the app so client components can use
 * useAuthActions()/useQuery() against the self-hosted Convex backend.
 *
 * Paired with <ConvexAuthNextjsServerProvider> in the root layout, which reads
 * the session cookie on the server.
 */
const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
