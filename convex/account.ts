import { mutation, query } from './_generated/server';
import { requireUser } from './lib/authz';
import {
  serializeCase,
  serializeDocument,
  serializeLetter,
  serializeSequence,
  serializePacket,
  serializeDeadlineEvent,
  serializeOutcome,
  serializeSubscription,
} from './lib/serialize';

/**
 * GDPR account deletion — atomic cascade.
 *
 * Improvement over the old route: the former code deleted across 7 child tables
 * + cases + subscriptions + waitlist in a loop with NO transaction. Here it is
 * a single mutation, so it is all-or-nothing.
 *
 * Returns the R2 object keys that must be deleted (documents.filePath,
 * letters.pdfUrl, packets.bundleUrl) so the calling route can remove them from
 * R2 via the storage action (storage can't be touched inside a mutation).
 *
 * The auth user row itself is deleted separately via users.deleteInternal after
 * this returns (also outside a mutation-only context, from the route).
 */
/**
 * GDPR data export — all of the current user's data across tables. Ownership is
 * inherent (everything is gathered under the user's own cases/subscriptions).
 * The route decrypts PII in diagnostic_state before returning to the user.
 */
export const exportMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);

    const cases = await ctx.db
      .query('cases')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const documents = [];
    const letters = [];
    const sequences = [];
    const packets = [];
    const deadlineEvents = [];
    const outcomes = [];
    for (const c of cases) {
      for (const d of await ctx.db.query('documents').withIndex('by_case', (q) => q.eq('caseId', c._id)).collect()) documents.push(serializeDocument(d));
      for (const l of await ctx.db.query('letters').withIndex('by_case', (q) => q.eq('caseId', c._id)).collect()) letters.push(serializeLetter(l));
      for (const s of await ctx.db.query('sequences').withIndex('by_case', (q) => q.eq('caseId', c._id)).collect()) sequences.push(serializeSequence(s));
      for (const p of await ctx.db.query('packets').withIndex('by_case', (q) => q.eq('caseId', c._id)).collect()) packets.push(serializePacket(p));
      for (const de of await ctx.db.query('deadlineEvents').withIndex('by_case', (q) => q.eq('caseId', c._id)).collect()) deadlineEvents.push(serializeDeadlineEvent(de));
      for (const o of await ctx.db.query('outcomes').withIndex('by_case', (q) => q.eq('caseId', c._id)).collect()) outcomes.push(serializeOutcome(o));
    }

    const subscriptions = (
      await ctx.db.query('subscriptions').withIndex('by_user', (q) => q.eq('userId', userId)).collect()
    ).map(serializeSubscription);

    return {
      cases: cases.map(serializeCase),
      documents,
      letters,
      sequences,
      packets,
      deadline_events: deadlineEvents,
      outcomes,
      subscriptions,
    };
  },
});

export const deleteMyAccountCascade = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);

    const cases = await ctx.db
      .query('cases')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const r2Keys: string[] = [];

    for (const c of cases) {
      const caseId = c._id;

      // documents (collect R2 keys, then delete)
      const docs = await ctx.db
        .query('documents')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect();
      for (const d of docs) {
        if (d.filePath) r2Keys.push(d.filePath);
        await ctx.db.delete(d._id);
      }

      // letters (pdfUrl → R2 key)
      const letters = await ctx.db
        .query('letters')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect();
      for (const l of letters) {
        if (l.pdfUrl) r2Keys.push(l.pdfUrl);
        await ctx.db.delete(l._id);
      }

      // sequences
      const sequences = await ctx.db
        .query('sequences')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect();
      for (const s of sequences) await ctx.db.delete(s._id);

      // packets (bundleUrl → R2 key)
      const packets = await ctx.db
        .query('packets')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect();
      for (const p of packets) {
        if (p.bundleUrl) r2Keys.push(p.bundleUrl);
        await ctx.db.delete(p._id);
      }

      // deadline_events
      const deadlines = await ctx.db
        .query('deadlineEvents')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect();
      for (const d of deadlines) await ctx.db.delete(d._id);

      // outcomes
      const outcomes = await ctx.db
        .query('outcomes')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect();
      for (const o of outcomes) await ctx.db.delete(o._id);

      // case_status_history
      const history = await ctx.db
        .query('caseStatusHistory')
        .withIndex('by_case', (q) => q.eq('caseId', caseId))
        .collect();
      for (const h of history) await ctx.db.delete(h._id);

      // the case itself
      await ctx.db.delete(caseId);
    }

    // subscriptions
    const subs = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const s of subs) await ctx.db.delete(s._id);

    return { userId, caseCount: cases.length, r2Keys };
  },
});
