import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

/**
 * Creates a Supabase client that uses the **service-role key**.
 *
 * @warning This client **bypasses Row-Level Security**. It must only be used
 * in trusted server-side contexts — background jobs, webhooks, and admin
 * scripts. Never expose this client or its key to the browser.
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
