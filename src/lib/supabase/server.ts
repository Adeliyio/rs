import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/types/database.types';

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 *
 * Must be called inside a request context (Server Component, Route Handler,
 * or Server Action) so that `cookies()` resolves correctly.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
            });
          } catch {
            // The `setAll` method is called from a Server Component where
            // cookies cannot be mutated. This is safe to ignore because the
            // middleware will refresh the session on the next request.
          }
        },
      },
    },
  );
}
