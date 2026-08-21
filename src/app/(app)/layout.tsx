import { redirect } from 'next/navigation';

import { q, currentUser, api } from '@/lib/convex/server';
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
  const user = await currentUser();
  if (!user) {
    redirect('/login');
  }

  const casesData = await q(api.cases.listMine, {});

  const cases: CaseSummary[] = casesData.map((row) => ({
    id: row.id,
    wedge: row.wedge as CaseSummary['wedge'],
    jurisdiction: row.jurisdiction,
    status: row.status as CaseSummary['status'],
    updated_at: row.updated_at ?? '',
  }));

  const userName = user.name ?? user.email?.split('@')[0] ?? 'User';
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
