import { getAuthUserId } from '@convex-dev/auth/server';
import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';

/**
 * Authorization helpers — the REPLACEMENT FOR SUPABASE ROW-LEVEL SECURITY.
 *
 * Convex has no RLS. In the old system, Postgres policies (migration 00005)
 * silently scoped every query to `auth.uid() = user_id` (directly for cases /
 * subscriptions, via a cases subquery for child tables). MANY queries therefore
 * omitted explicit user filters and relied entirely on RLS.
 *
 * Here, that scoping must be EXPLICIT and is centralised in these helpers.
 * Every user-facing query/mutation MUST resolve identity through `requireUser`
 * and gate row access through `requireCaseOwner` (or an equivalent ownership
 * check). Skipping them re-introduces the cross-tenant data leak RLS prevented.
 *
 * Service-role contexts (workers, webhooks, admin, payments) do NOT use these —
 * they already passed explicit filters under Supabase and continue to operate
 * with internal functions that take an explicit userId/caseId.
 */

/* ------------------------------------------------------------------ */
/*  Identity                                                          */
/* ------------------------------------------------------------------ */

/** Returns the authenticated user id, or null when unauthenticated. */
export async function getUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'> | null> {
  return getAuthUserId(ctx);
}

/**
 * Returns the authenticated user id or throws. Mirrors the old
 * `getUser() → 401 Unauthorized` guard that opened almost every route.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error('Unauthorized');
  }
  return userId;
}

/** Returns the authenticated user's full document, or throws. */
export async function requireUserDoc(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get(userId);
  if (user === null) {
    throw new Error('Unauthorized');
  }
  return user;
}

/* ------------------------------------------------------------------ */
/*  Case ownership (the RLS subquery, made explicit)                 */
/* ------------------------------------------------------------------ */

/**
 * Loads a case and verifies the current user owns it and it is not
 * soft-deleted. Throws 'Not found' otherwise (matching the old behaviour where
 * RLS made non-owned / deleted rows simply invisible → 404).
 *
 * This is the single choke point that reproduces the child-table RLS policies:
 * documents/letters/sequences/packets/deadline_events/case_status_history/
 * outcomes all derive ownership from their parent case.
 */
export async function requireCaseOwner(
  ctx: QueryCtx | MutationCtx,
  caseId: Id<'cases'>,
): Promise<Doc<'cases'>> {
  const userId = await requireUser(ctx);
  const caseDoc = await ctx.db.get(caseId);
  if (
    caseDoc === null ||
    caseDoc.userId !== userId ||
    caseDoc.deletedAt !== undefined
  ) {
    throw new Error('Not found');
  }
  return caseDoc;
}

/**
 * Verifies ownership of a case referenced by a child row's `caseId`.
 * Used by child-table queries/mutations that already hold the child doc.
 */
export async function assertOwnsCase(
  ctx: QueryCtx | MutationCtx,
  caseId: Id<'cases'>,
): Promise<void> {
  await requireCaseOwner(ctx, caseId);
}

/* ------------------------------------------------------------------ */
/*  Admin                                                             */
/* ------------------------------------------------------------------ */

/**
 * Admin allowlist check. Admin identity remains an env-based email allowlist
 * (ADMIN_EMAILS), matching the old `requireAdmin()`; it is NOT a DB role.
 *
 * The IP allowlist (ADMIN_IP_ALLOWLIST) stays in the Next.js route layer,
 * where request headers are available — Convex functions do not see the client
 * IP. So admin routes call `requireAdmin()` (Next side) for IP + this check for
 * identity, preserving the two-factor gate.
 */
export async function requireAdminUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<'users'>> {
  const user = await requireUserDoc(ctx);
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
  const email = (user.email ?? '').toLowerCase();
  if (!adminEmails.has(email)) {
    throw new Error('Forbidden');
  }
  return user;
}
