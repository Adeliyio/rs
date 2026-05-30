/**
 * POST /api/account/delete
 *
 * GDPR/CCPA right to deletion — cascading delete of all user data.
 *
 * Security (VULN-03):
 * - Requires re-authentication via password
 * - Requires explicit confirmation phrase ("DELETE MY ACCOUNT")
 * - Uses POST (not DELETE) to enforce JSON body parsing
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
 * 11. Supabase Storage files (recursive)
 * 12. Supabase Auth user (signs them out)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.string().refine(
    (val) => val === CONFIRMATION_PHRASE,
    { message: `You must type "${CONFIRMATION_PHRASE}" to confirm.` },
  ),
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Recursively deletes all files under a user's storage folder.
 * The storage structure is: {userId}/{caseId}/{filename}
 * We must list subdirectories first, then delete files within each.
 */
async function deleteUserStorageFiles(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
): Promise<void> {
  // List top-level items (these are the case subdirectories)
  const { data: topLevel } = await serviceClient.storage
    .from('documents')
    .list(userId);

  if (!topLevel || topLevel.length === 0) return;

  for (const item of topLevel) {
    // Check if this is a directory by listing its contents
    const subPath = `${userId}/${item.name}`;
    const { data: subFiles } = await serviceClient.storage
      .from('documents')
      .list(subPath);

    if (subFiles && subFiles.length > 0) {
      // It's a directory — delete all files within it
      const filePaths = subFiles.map((f) => `${subPath}/${f.name}`);
      await serviceClient.storage.from('documents').remove(filePaths);
    }

    // Also try to remove the item itself (in case it's a direct file)
    await serviceClient.storage.from('documents').remove([subPath]);
  }
}

/* ------------------------------------------------------------------ */
/*  POST handler (uses POST to require JSON body)                     */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  try {
    /* ---- Auth: verify current session ---- */
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    /* ---- Parse and validate body ---- */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    /* ---- Re-authenticate: verify password (VULN-03) ---- */
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: parsed.data.password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Incorrect password. Account deletion requires your current password.' },
        { status: 401 },
      );
    }

    /* ---- Proceed with deletion ---- */
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

    // Delete storage files (recursive — VULN-07 fix)
    try {
      await deleteUserStorageFiles(serviceClient, userId);
    } catch {
      // Storage deletion is best-effort — don't block account deletion
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
    console.error('POST /api/account/delete error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE handler — returns a 405 directing clients to use POST.
 * Kept for backwards-compatibility so old clients get a clear error.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST with { password, confirmation } body.',
      required_confirmation: CONFIRMATION_PHRASE,
    },
    { status: 405 },
  );
}
