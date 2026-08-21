import { v } from 'convex/values';
import { query, internalQuery, internalMutation } from './_generated/server';
import { requireCaseOwner } from './lib/authz';
import { serializeLetter } from './lib/serialize';

/**
 * Letters (generated demand letters). Ownership via parent case. Created by the
 * generation worker / generate route (internal). `pdfUrl` holds the R2 key.
 */

export const latestByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('letters')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    const latest = rows
      .filter((l) => l.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return latest ? serializeLetter(latest) : null;
  },
});

export const createInternal = internalMutation({
  args: {
    caseId: v.id('cases'),
    content: v.string(),
    groundingContextIds: v.optional(v.array(v.string())),
    citationValidation: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert('letters', {
      caseId: args.caseId,
      content: args.content,
      groundingContextIds: args.groundingContextIds,
      citationValidation: args.citationValidation,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return serializeLetter(doc!);
  },
});

export const latestByCaseInternal = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const rows = await ctx.db
      .query('letters')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    const latest = rows.sort((a, b) => b.createdAt - a.createdAt)[0];
    return latest ? serializeLetter(latest) : null;
  },
});

export const setPdfUrlInternal = internalMutation({
  args: { letterId: v.id('letters'), pdfUrl: v.string() },
  handler: async (ctx, { letterId, pdfUrl }) => {
    await ctx.db.patch(letterId, { pdfUrl, updatedAt: Date.now() });
  },
});
