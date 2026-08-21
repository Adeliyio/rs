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

/**
 * Owner-gated sequence advance. Validates step_number matches current_step,
 * stamps sent_dates, computes next step + next_send_at, and transitions the
 * parent case status (sent after step 1, awaiting after step 3) — all atomic.
 * Mirrors POST /api/sequences/[id]/advance. The email side-effect stays in the
 * route (BullMQ). Returns the data the route needs to enqueue the reminder.
 */
export const advanceStepMine = mutation({
  args: { sequenceId: v.id('sequences'), stepNumber: v.number() },
  handler: async (ctx, { sequenceId, stepNumber }) => {
    const seq = await ctx.db.get(sequenceId);
    if (!seq) throw new Error('Not found');
    const caseDoc = await requireCaseOwner(ctx, seq.caseId);

    if (stepNumber !== seq.currentStep) {
      throw new Error(`STEP_MISMATCH:${seq.currentStep}:${stepNumber}`);
    }

    const now = Date.now();
    const stepsData = (seq.steps ?? {}) as Record<string, unknown>;
    const sentDates = (stepsData.sent_dates as Record<string, string>) ?? {};
    sentDates[String(stepNumber)] = new Date(now).toISOString();
    const updatedSteps = { ...stepsData, sent_dates: sentDates };

    const maxSteps = 3;
    const nextStep = stepNumber + 1;
    const isComplete = stepNumber >= maxSteps;
    const nextSendAt = isComplete ? undefined : now + 7 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(sequenceId, {
      currentStep: isComplete ? maxSteps : nextStep,
      nextSendAt,
      steps: updatedSteps,
      updatedAt: now,
    });

    // Case status transition.
    let newStatus: string | null = null;
    if (stepNumber === 1) newStatus = 'sent';
    else if (stepNumber === 3) newStatus = 'awaiting';

    if (newStatus && newStatus !== caseDoc.status) {
      await ctx.db.patch(seq.caseId, {
        status: newStatus as typeof caseDoc.status,
        updatedAt: now,
      });
      await ctx.db.insert('caseStatusHistory', {
        caseId: seq.caseId,
        previousStatus: caseDoc.status,
        newStatus: newStatus as typeof caseDoc.status,
        changedAt: now,
      });
    }

    return {
      caseId: seq.caseId,
      isComplete,
      nextStep,
      nextStepName:
        ((stepsData.steps as { name?: string }[] | undefined) ?? [])[nextStep - 1]?.name ??
        `Step ${nextStep}`,
      companyName: (stepsData.jurisdiction as string) ?? 'the company',
    };
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
