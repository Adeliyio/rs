/**
 * DELETE /api/account/delete
 *
 * GDPR/CCPA right to deletion — cascading delete of all user data.
 *
 * Deletion order (respects FK constraints):
 * 1. deadline_events (via case_id)
 * 2. outcomes (via case_id)
 * 3. packets (via case_id)
 * 4. letters (via case_id)
 * 5. sequences (via case_id)
 * 6. documents (via case_id)
 * 7. case_status_history (via case_id)
 * 8. cases
 * 9. subscriptions
 * 10. waitlist_entries
 * 11. Supabase Storage files
 * 12. Supabase Auth user (signs them out)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const serviceClient = createServiceRoleClient();

    // Get all case IDs for this user
    const { data: cases } = await serviceClient
      .from('cases')
      .select('id')
      .eq('user_id', userId);

    const caseIds = (cases ?? []).map((c) => (c as unknown as { id: string }).id);

    if (caseIds.length > 0) {
      // Delete in FK order — child tables first
      for (const table of [
        'deadline_events',
        'outcomes',
        'packets',
        'letters',
        'sequences',
        'documents',
        'case_status_history',
      ] as const) {
        await serviceClient.from(table).delete().in('case_id', caseIds);
      }

      // Delete cases
      await serviceClient.from('cases').delete().eq('user_id', userId);
    }

    // Delete subscriptions
    await serviceClient.from('subscriptions').delete().eq('user_id', userId);

    // Delete waitlist entries (by email)
    if (user.email) {
      await serviceClient.from('waitlist_entries').delete().eq('email', user.email);
    }

    // Delete storage files
    try {
      const { data: files } = await serviceClient.storage
        .from('documents')
        .list(userId);

      if (files && files.length > 0) {
        const paths = files.map((f) => `${userId}/${f.name}`);
        await serviceClient.storage.from('documents').remove(paths);
      }
    } catch {
      // Storage deletion is best-effort
    }

    // Delete the auth user (this signs them out)
    await serviceClient.auth.admin.deleteUser(userId);

    return NextResponse.json({
      ok: true,
      deleted: {
        cases: caseIds.length,
        user: userId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('DELETE /api/account/delete error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
