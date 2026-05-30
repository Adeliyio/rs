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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // VULN-17: Fail fast if credentials are missing rather than creating
  // a broken client that silently fails on every operation.
  if (!url || !key) {
    throw new Error(
      'Cannot create service-role client: NEXT_PUBLIC_SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY must both be set.',
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
