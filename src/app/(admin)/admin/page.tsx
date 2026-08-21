import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/convex/server';
import { AdminDashboard } from '@/features/admin/components/admin-dashboard';

/**
 * Admin dashboard — server component.
 * Restricted to admin users (email allowlist via ADMIN_EMAILS).
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default async function AdminPage() {
  const user = await currentUser();

  if (!user || !ADMIN_EMAILS.includes((user.email ?? '').toLowerCase())) {
    redirect('/');
  }

  return <AdminDashboard />;
}
