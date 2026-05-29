import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/dashboard/sidebar';

import type { CaseSummary } from '@/components/dashboard/sidebar';

/**
 * App shell layout — sidebar + main content area.
 *
 * The sidebar is the "lightweight 'your cases' sidebar for multi-case users"
 * from PRD §5.1. The main area renders whatever step the user is currently on
 * in the progressive flow — never a dashboard overview.
 *
 * Fetches the authenticated user and their cases from Supabase.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.JSX.Element> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // TODO: Remove type assertion when real database types are generated via `pnpm db:gen-types`
  const { data: casesData } = await supabase
    .from('cases')
    .select('id, wedge, jurisdiction, status, updated_at')
    .order('updated_at', { ascending: false });

  const cases: CaseSummary[] =
    (casesData as unknown as { id: string; wedge: string; jurisdiction: string; status: string; updated_at: string }[] | null)?.map(
      (row) => ({
        id: row.id,
        wedge: row.wedge as CaseSummary['wedge'],
        jurisdiction: row.jurisdiction,
        status: row.status as CaseSummary['status'],
        updated_at: row.updated_at,
      }),
    ) ?? [];

  const userName =
    user.user_metadata?.full_name as string | undefined ??
    user.email?.split('@')[0] ??
    'User';

  const userEmail = user.email ?? '';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        cases={cases}
        userName={userName}
        userEmail={userEmail}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10 sm:px-12">
          {children}
        </div>
      </main>
    </div>
  );
}
