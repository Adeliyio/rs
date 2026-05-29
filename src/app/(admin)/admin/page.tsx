import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminDashboard } from '@/features/admin/components/admin-dashboard';

/**
 * Admin dashboard — server component.
 * Restricted to admin users (checked via Supabase user metadata).
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').filter(Boolean);

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    redirect('/');
  }

  return <AdminDashboard />;
}
