import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { requireUser, requireCaseOwner } from './lib/authz';
import { serializeCase } from './lib/serialize';

/**
 * Cases — the core table. User-facing functions enforce ownership via the
 * authz helpers (RLS replacement). Internal functions take an explicit userId/
 * caseId and are called by trusted server contexts (workers, webhooks, routes
 * that previously used the service-role client).
 *
 * All user-facing reads return the legacy snake_case row shape via serializeCase.
 */

const ACTIVE_STATUSES = ['resolved', 'closed'] as const;

/* ================================================================== */
/*  User-facing                                                       */
/* ================================================================== */

/** List the current user's non-deleted cases, newest updated first. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query('cases')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows
      .filter((c) => c.deletedAt === undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(serializeCase);
  },
});

/** Get one case the current user owns (or null). */
export const getMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const userId = await requireUser(ctx);
    const doc = await ctx.db.get(caseId);
    if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) {
      return null;
    }
    return serializeCase(doc);
  },
});

/**
 * Create a case. Enforces the former `uq_active_case` partial-unique index in
 * app code: at most one non-deleted, non-(resolved|closed) case per
 * (user, wedge, jurisdiction).
 *
 * Returns { case, duplicateOf } — duplicateOf is the existing active case id
 * when the uniqueness guard trips (mirrors the old 409 DUPLICATE_ACTIVE_CASE).
 */
export const create = mutation({
  args: { wedge: v.union(v.literal('deposit'), v.literal('subscription')), jurisdiction: v.string() },
  handler: async (ctx, { wedge, jurisdiction }) => {
    const userId = await requireUser(ctx);

    const existing = await ctx.db
      .query('cases')
      .withIndex('by_user_wedge_jurisdiction', (q) =>
        q.eq('userId', userId).eq('wedge', wedge).eq('jurisdiction', jurisdiction),
      )
      .collect();

    const active = existing.find(
      (c) =>
        c.deletedAt === undefined &&
        !(ACTIVE_STATUSES as readonly string[]).includes(c.status),
    );
    if (active) {
      return { case: serializeCase(active), duplicateOf: active._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert('cases', {
      userId,
      wedge,
      jurisdiction,
      status: 'intake',
      diagnosticState: {},
      paymentStatus: 'pending',
      totalAiCost: 0,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return { case: serializeCase(doc!), duplicateOf: null };
  },
});

/** Patch owned-case fields. Only whitelisted fields are writable by the owner. */
export const updateMine = mutation({
  args: {
    caseId: v.id('cases'),
    patch: v.object({
      status: v.optional(v.string()),
      paymentStatus: v.optional(v.string()),
      diagnosticState: v.optional(v.any()),
      previewShownAt: v.optional(v.number()),
      refusalTrigger: v.optional(v.string()),
      paddleTransactionId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { caseId, patch }) => {
    await requireCaseOwner(ctx, caseId);
    const clean: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) clean[k] = val;
    }
    await ctx.db.patch(caseId, clean);
    const doc = await ctx.db.get(caseId);
    return serializeCase(doc!);
  },
});

/**
 * Save diagnostic state on an owned case, optionally syncing the jurisdiction
 * the diagnostic collected. Mirrors PUT /api/diagnostic/state.
 */
export const saveDiagnosticState = mutation({
  args: {
    caseId: v.id('cases'),
    diagnosticState: v.any(),
    jurisdiction: v.optional(v.string()),
  },
  handler: async (ctx, { caseId, diagnosticState, jurisdiction }) => {
    await requireCaseOwner(ctx, caseId);
    const patch: Record<string, unknown> = { diagnosticState, updatedAt: Date.now() };
    if (jurisdiction) patch.jurisdiction = jurisdiction;
    await ctx.db.patch(caseId, patch);
    return { ok: true };
  },
});

/** Soft-delete an owned case. */
export const softDeleteMine = mutation({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    await ctx.db.patch(caseId, { deletedAt: Date.now(), updatedAt: Date.now() });
  },
});

/* ================================================================== */
/*  Internal (trusted contexts — explicit ids, no session authz)      */
/* ================================================================== */

export const getInternal = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const doc = await ctx.db.get(caseId);
    return doc ? serializeCase(doc) : null;
  },
});

export const listByUserInternal = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('cases')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    return rows.map(serializeCase);
  },
});

/** Count non-deleted cases whose status is in the given list (trust/stats). */
export const countByStatusInternal = internalQuery({
  args: { statuses: v.array(v.string()) },
  handler: async (ctx, { statuses }) => {
    const set = new Set(statuses);
    const rows = await ctx.db.query('cases').collect();
    return rows.filter((c) => c.deletedAt === undefined && set.has(c.status)).length;
  },
});

/** Recent non-deleted cases for the admin dashboard, newest first. */
export const listRecentInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query('cases').collect();
    return rows
      .filter((c) => c.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit ?? 100)
      .map(serializeCase);
  },
});

/** Total non-deleted case count (admin stats). */
export const countAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('cases').collect();
    return rows.filter((c) => c.deletedAt === undefined).length;
  },
});

export const patchInternal = internalMutation({
  args: { caseId: v.id('cases'), patch: v.any() },
  handler: async (ctx, { caseId, patch }) => {
    await ctx.db.patch(caseId, { ...patch, updatedAt: Date.now() });
    const doc = await ctx.db.get(caseId);
    return doc ? serializeCase(doc) : null;
  },
});
