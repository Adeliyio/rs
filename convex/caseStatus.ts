import { v } from 'convex/values';
import { mutation, internalMutation, internalQuery } from './_generated/server';
import { requireCaseOwner } from './lib/authz';
import { serializeCase, serializeStatusHistory } from './lib/serialize';

/**
 * Case status state machine + case_status_history.
 *
 * Mirrors POST /api/cases/[id]/status. The transition table is duplicated here
 * so the guard runs inside the mutation (atomic with the history insert).
 * Outcome-email scheduling stays in the Next.js route (it uses BullMQ), which
 * calls this mutation then fires the queue side-effect.
 */

const CASE_STATUSES = [
  'intake',
  'generated',
  'sent',
  'awaiting',
  'escalation_drafted',
  'resolved',
  'closed',
] as const;
type CaseStatus = (typeof CASE_STATUSES)[number];

const VALID_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  intake: ['generated', 'closed'],
  generated: ['sent', 'closed'],
  sent: ['awaiting', 'closed'],
  awaiting: ['escalation_drafted', 'resolved', 'closed'],
  escalation_drafted: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],
};

function isCaseStatus(v: string): v is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(v);
}

/**
 * Owner-gated status transition. Throws with a descriptive message on an
 * invalid transition (the route maps it to a 400). Returns the updated case,
 * the previous status, and whether the transition was applied.
 */
export const transitionMine = mutation({
  args: { caseId: v.id('cases'), newStatus: v.string() },
  handler: async (ctx, { caseId, newStatus }) => {
    const caseDoc = await requireCaseOwner(ctx, caseId);

    if (!isCaseStatus(newStatus)) {
      throw new Error(`INVALID_STATUS:${newStatus}`);
    }
    const prev = caseDoc.status;
    if (!VALID_TRANSITIONS[prev].includes(newStatus)) {
      throw new Error(
        `INVALID_TRANSITION:${prev}->${newStatus}:${VALID_TRANSITIONS[prev].join(',') || 'none'}`,
      );
    }

    const now = Date.now();
    await ctx.db.patch(caseId, { status: newStatus, updatedAt: now });
    await ctx.db.insert('caseStatusHistory', {
      caseId,
      previousStatus: prev,
      newStatus,
      changedAt: now,
    });

    const updated = await ctx.db.get(caseId);
    return { case: serializeCase(updated!), previousStatus: prev };
  },
});

/**
 * Internal transition for trusted contexts (workers, webhooks, generate route)
 * that previously wrote status + history via the service-role client.
 * No state-machine guard here — callers already enforce their own flow.
 */
export const setStatusInternal = internalMutation({
  args: { caseId: v.id('cases'), newStatus: v.string() },
  handler: async (ctx, { caseId, newStatus }) => {
    const caseDoc = await ctx.db.get(caseId);
    if (!caseDoc) throw new Error('Not found');
    const now = Date.now();
    await ctx.db.patch(caseId, { status: newStatus, updatedAt: now });
    await ctx.db.insert('caseStatusHistory', {
      caseId,
      previousStatus: caseDoc.status,
      newStatus,
      changedAt: now,
    });
  },
});

/** Record a history row without changing case status (rare; parity helper). */
export const insertHistoryInternal = internalMutation({
  args: {
    caseId: v.id('cases'),
    previousStatus: v.string(),
    newStatus: v.string(),
  },
  handler: async (ctx, { caseId, previousStatus, newStatus }) => {
    await ctx.db.insert('caseStatusHistory', {
      caseId,
      previousStatus: previousStatus as CaseStatus,
      newStatus: newStatus as CaseStatus,
      changedAt: Date.now(),
    });
  },
});

/** Most-recent history row matching a target new_status (for "sent at"). */
export const latestHistoryByStatusInternal = internalQuery({
  args: { caseId: v.id('cases'), newStatus: v.string() },
  handler: async (ctx, { caseId, newStatus }) => {
    const rows = await ctx.db
      .query('caseStatusHistory')
      .withIndex('by_case', (q) => q.eq('caseId', caseId))
      .collect();
    const match = rows
      .filter((r) => r.newStatus === newStatus)
      .sort((a, b) => b.changedAt - a.changedAt)[0];
    return match ? serializeStatusHistory(match) : null;
  },
});
