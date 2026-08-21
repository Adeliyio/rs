import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { requireCaseOwner, assertOwnsCase } from './lib/authz';
import { serializeDocument } from './lib/serialize';

/**
 * Documents (uploaded evidence). Ownership derives from the parent case
 * (replaces the RLS cases-subquery policy). File bytes live in R2; `filePath`
 * holds the R2 object key.
 */

/* ---- user-facing ---- */

export const listByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('documents')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.filter((d) => d.deletedAt === undefined).map(serializeDocument);
  },
});

export const countByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('documents')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.filter((d) => d.deletedAt === undefined).length;
  },
});

export const getMine = query({
  args: { documentId: v.id('documents') },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return null;
    await assertOwnsCase(ctx, doc.caseId);
    return serializeDocument(doc);
  },
});

/** Owner-gated confirmation of extracted fields. */
export const confirmMine = mutation({
  args: { documentId: v.id('documents'), confirmedFields: v.any() },
  handler: async (ctx, { documentId, confirmedFields }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) throw new Error('Not found');
    await assertOwnsCase(ctx, doc.caseId);
    await ctx.db.patch(documentId, {
      confirmedJson: confirmedFields,
      parseStatus: 'confirmed',
      authenticityAck: true,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/* ---- internal (upload/parse pipeline runs via service-role-equivalent) ---- */

export const createInternal = internalMutation({
  args: {
    caseId: v.id('cases'),
    filePath: v.string(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, { caseId, filePath, contentType }) => {
    const now = Date.now();
    const id = await ctx.db.insert('documents', {
      caseId,
      filePath,
      contentType,
      parseStatus: 'pending',
      authenticityAck: false,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return serializeDocument(doc!);
  },
});

export const getInternal = internalQuery({
  args: { documentId: v.id('documents') },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    return doc ? serializeDocument(doc) : null;
  },
});

export const patchInternal = internalMutation({
  args: { documentId: v.id('documents'), patch: v.any() },
  handler: async (ctx, { documentId, patch }) => {
    await ctx.db.patch(documentId, { ...patch, updatedAt: Date.now() });
    const doc = await ctx.db.get(documentId);
    return doc ? serializeDocument(doc) : null;
  },
});

export const listByCaseInternal = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const rows = await ctx.db
      .query('documents')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.map(serializeDocument);
  },
});

export const deleteByCaseInternal = internalMutation({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const rows = await ctx.db
      .query('documents')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return rows.map((r) => r.filePath); // R2 keys the caller should remove
  },
});
