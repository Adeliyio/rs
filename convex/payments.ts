import { v } from 'convex/values';
import { internalQuery, internalMutation } from './_generated/server';
import { serializeCase } from './lib/serialize';

/**
 * Payment-related case lookups/updates used by the Polar webhook processor and
 * the auto-refund flow. All internal (webhooks run outside a user session; the
 * old code used the service-role client).
 */

export const caseByPolarOrderInternal = internalQuery({
  args: { polarOrderId: v.string() },
  handler: async (ctx, { polarOrderId }) => {
    const doc = await ctx.db
      .query('cases')
      .withIndex('by_polar_order_id', (q) =>
        q.eq('polarOrderId', polarOrderId),
      )
      .unique();
    return doc ? serializeCase(doc) : null;
  },
});

/** Set payment status (and optionally status) on a case; records history when status changes. */
export const setPaymentStatusInternal = internalMutation({
  args: {
    caseId: v.id('cases'),
    paymentStatus: v.string(),
    newStatus: v.optional(v.string()),
  },
  handler: async (ctx, { caseId, paymentStatus, newStatus }) => {
    const caseDoc = await ctx.db.get(caseId);
    if (!caseDoc) throw new Error('Not found');
    const now = Date.now();
    const patch: Record<string, unknown> = { paymentStatus, updatedAt: now };
    if (newStatus && newStatus !== caseDoc.status) {
      patch.status = newStatus;
      await ctx.db.insert('caseStatusHistory', {
        caseId,
        previousStatus: caseDoc.status,
        newStatus: newStatus as typeof caseDoc.status,
        changedAt: now,
      });
    }
    await ctx.db.patch(caseId, patch);
    const updated = await ctx.db.get(caseId);
    return updated ? serializeCase(updated) : null;
  },
});
