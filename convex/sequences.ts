import { v } from 'convex/values';
import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { requireCaseOwner } from './lib/authz';
import { serializeSequence } from './lib/serialize';

/**
 * Sequences (subscription-cancellation email sequences). Ownership via parent
 * case. Advanced by the sequence advance route / worker.
 */

export const latestByCaseMine = query({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    await requireCaseOwner(ctx, caseId);
    const rows = await ctx.db
      .query('sequences')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    const latest = rows
      .filter((s) => s.deletedAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    return latest ? serializeSequence(latest) : null;
  },
});

/** Owner-gated advance to a given step + next send time. */
export const advanceMine = mutation({
  args: {
    sequenceId: v.id('sequences'),
    currentStep: v.number(),
    nextSendAt: v.optional(v.number()),
  },
  handler: async (ctx, { sequenceId, currentStep, nextSendAt }) => {
    const seq = await ctx.db.get(sequenceId);
    if (!seq) throw new Error('Not found');
    await requireCaseOwner(ctx, seq.caseId);
    await ctx.db.patch(sequenceId, { currentStep, nextSendAt, updatedAt: Date.now() });
    const updated = await ctx.db.get(sequenceId);
    return serializeSequence(updated!);
  },
});

export const createInternal = internalMutation({
  args: {
    caseId: v.id('cases'),
    vertical: v.string(),
    steps: v.any(),
    nextSendAt: v.optional(v.number()),
    groundingContextIds: v.optional(v.array(v.string())),
    citationValidation: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert('sequences', {
      caseId: args.caseId,
      vertical: args.vertical,
      currentStep: 1,
      nextSendAt: args.nextSendAt,
      steps: args.steps,
      groundingContextIds: args.groundingContextIds,
      citationValidation: args.citationValidation,
      createdAt: now,
      updatedAt: now,
    });
    const doc = await ctx.db.get(id);
    return serializeSequence(doc!);
  },
});

export const latestByCaseInternal = internalQuery({
  args: { caseId: v.id('cases') },
  handler: async (ctx, { caseId }) => {
    const rows = await ctx.db
      .query('sequences')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    const latest = rows.sort((a, b) => b.createdAt - a.createdAt)[0];
    return latest ? serializeSequence(latest) : null;
  },
});

export const patchInternal = internalMutation({
  args: { sequenceId: v.id('sequences'), patch: v.any() },
  handler: async (ctx, { sequenceId, patch }) => {
    await ctx.db.patch(sequenceId, { ...patch, updatedAt: Date.now() });
    const doc = await ctx.db.get(sequenceId);
    return doc ? serializeSequence(doc) : null;
  },
});
