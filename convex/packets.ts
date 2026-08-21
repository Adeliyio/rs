import { v } from 'convex/values';
import { query, internalQuery, internalMutation } from './_generated/server';
import { requireCaseOwner } from './lib/authz';
import { serializePacket } from './lib/serialize';

/**
 * Packets (filing-packet ZIP bundles). Ownership via parent case.
 * `bundleUrl` holds the R2 object key.
 */

export const listByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('packets')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.filter((p) => p.deletedAt === undefined).map(serializePacket);
  },
});

export const hasByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('packets')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.some((p) => p.deletedAt === undefined);
  },
});

export const createInternal = internalMutation({
  args: {
    caseId: v.id('cases'),
    venue: v.string(),
    type: v.string(),
    bundleUrl: v.optional(v.string()),
    templateVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert('packets', {
      caseId: args.caseId,
      venue: args.venue,
      type: args.type,
      bundleUrl: args.bundleUrl,
      templateVersion: args.templateVersion,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return serializePacket(doc!);
  },
});

export const listByCaseInternal = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const rows = await ctx.db
      .query('packets')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    return rows.map(serializePacket);
  },
});
