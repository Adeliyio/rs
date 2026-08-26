/**
 * POST /api/account/delete
 *
 * GDPR/CCPA right to deletion — atomic cascade across all user data.
 *
 * Improvement over the old flow: the deletion runs as a single Convex mutation
 * (account.deleteMyAccountCascade), so the DB portion is all-or-nothing. It
 * returns the R2 object keys, which we then remove from storage, before
 * deleting the auth user.
 *
 * Re-authentication (VULN-03): the caller must supply the confirmation phrase.
 * NOTE: Convex Auth does not expose a synchronous server-side password re-check
 * the way Supabase did; the strong confirmation phrase + authenticated session
 * is the gate here. (A future enhancement can add a re-auth challenge.)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { m, currentUser, api } from '@/lib/convex/server';
import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import type { Id } from '@convex/dataModel';

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

const deleteAccountSchema = z.object({
  password: z.string().optional(),
  confirmation: z.string().refine((val) => val === CONFIRMATION_PHRASE, {
    message: `You must type "${CONFIRMATION_PHRASE}" to confirm.`,
  }),
});

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    /* ---- Atomic cascade delete of all DB data (returns R2 keys) ---- */
    const { caseCount, r2Keys } = await m(api.account.deleteMyAccountCascade, {});

    const convex = createServiceConvexClient();
    const secret = serviceSecret();

    /* ---- Best-effort R2 cleanup ---- */
    if (r2Keys.length > 0) {
      try {
        await convex.action(api.service.deleteObjects, { secret, keys: r2Keys });
      } catch {
        // best-effort — do not block account deletion
      }
    }

    /* ---- Waitlist erasure (GDPR right to erasure) ----
     * Waitlist rows are keyed by email, not userId, so they are outside the
     * per-user cascade above. The old Supabase flow deleted them by email; this
     * restores that so a deleted user leaves no waitlist record behind. */
    if (user.email) {
      try {
        await convex.mutation(api.service.deleteWaitlistByEmail, {
          secret,
          email: user.email,
        });
      } catch {
        // best-effort — do not block account deletion
      }
    }

    /* ---- Delete the auth user (signs them out) ---- */
    await convex.mutation(api.service.deleteUser, {
      secret,
      userId: user.id as Id<'users'>,
    });

    return NextResponse.json({ ok: true, deleted: { cases: caseCount, user: user.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/account/delete error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST with { confirmation } body.',
      required_confirmation: CONFIRMATION_PHRASE,
    },
    { status: 405 },
  );
}
