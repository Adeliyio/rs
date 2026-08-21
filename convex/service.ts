import { v } from 'convex/values';
import { query, mutation, action } from './_generated/server';
import { internal } from './_generated/api';

/**
 * SERVICE FUNCTIONS — the replacement for the Supabase service-role key.
 *
 * These are PUBLIC (callable over HTTP from trusted Node contexts: the Paddle
 * webhook processor, BullMQ workers, and admin API routes) but every one
 * requires the shared `CONVEX_SERVICE_SECRET`. That secret is the trust
 * boundary: possessing it means "act as the system", exactly like the old
 * service-role key. It must never reach the browser.
 *
 * Each wrapper simply forwards to the corresponding `internal.*` function via
 * ctx.runQuery / ctx.runMutation / ctx.runAction after checking the secret.
 */

function assertSecret(secret: string) {
  const expected = process.env.CONVEX_SERVICE_SECRET;
  if (!expected || secret !== expected) {
    throw new Error('Forbidden: invalid service secret');
  }
}

const secretArg = { secret: v.string() };

/* ------------------------------------------------------------------ */
/*  cases / payments                                                  */
/* ------------------------------------------------------------------ */

export const getCase = query({
  args: { ...secretArg, caseId: v.id('cases') },
  handler: async (ctx, { secret, caseId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.cases.getInternal, { caseId });
  },
});

export const listCasesByUser = query({
  args: { ...secretArg, userId: v.id('users') },
  handler: async (ctx, { secret, userId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.cases.listByUserInternal, { userId });
  },
});

export const countCasesByStatus = query({
  args: { ...secretArg, statuses: v.array(v.string()) },
  handler: async (ctx, { secret, statuses }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.cases.countByStatusInternal, { statuses });
  },
});

export const countAllCases = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.cases.countAllInternal, {});
  },
});

export const patchCase = mutation({
  args: { ...secretArg, caseId: v.id('cases'), patch: v.any() },
  handler: async (ctx, { secret, caseId, patch }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.cases.patchInternal, { caseId, patch });
  },
});

export const caseByPaddleTxn = query({
  args: { ...secretArg, paddleTransactionId: v.string() },
  handler: async (ctx, { secret, paddleTransactionId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.payments.caseByPaddleTxnInternal, { paddleTransactionId });
  },
});

export const setPaymentStatus = mutation({
  args: {
    ...secretArg,
    caseId: v.id('cases'),
    paymentStatus: v.string(),
    newStatus: v.optional(v.string()),
  },
  handler: async (ctx, { secret, caseId, paymentStatus, newStatus }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.payments.setPaymentStatusInternal, {
      caseId,
      paymentStatus,
      newStatus,
    });
  },
});

export const setCaseStatus = mutation({
  args: { ...secretArg, caseId: v.id('cases'), newStatus: v.string() },
  handler: async (ctx, { secret, caseId, newStatus }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.caseStatus.setStatusInternal, { caseId, newStatus });
  },
});

export const latestHistoryByStatus = query({
  args: { ...secretArg, caseId: v.id('cases'), newStatus: v.string() },
  handler: async (ctx, { secret, caseId, newStatus }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.caseStatus.latestHistoryByStatusInternal, { caseId, newStatus });
  },
});

export const adminStats = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.adminStats.statsInternal, {});
  },
});

export const listRecentCases = query({
  args: { ...secretArg, limit: v.optional(v.number()) },
  handler: async (ctx, { secret, limit }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.cases.listRecentInternal, { limit });
  },
});

export const trustStats = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.trustStats.statsInternal, {});
  },
});

/* ------------------------------------------------------------------ */
/*  documents / letters / sequences / packets                         */
/* ------------------------------------------------------------------ */

export const createDocument = mutation({
  args: { ...secretArg, caseId: v.id('cases'), filePath: v.string(), contentType: v.optional(v.string()) },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.documents.createInternal, a);
  },
});

export const getDocument = query({
  args: { ...secretArg, documentId: v.id('documents') },
  handler: async (ctx, { secret, documentId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.documents.getInternal, { documentId });
  },
});

export const patchDocument = mutation({
  args: { ...secretArg, documentId: v.id('documents'), patch: v.any() },
  handler: async (ctx, { secret, documentId, patch }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.documents.patchInternal, { documentId, patch });
  },
});

export const listDocumentsByCase = query({
  args: { ...secretArg, caseId: v.id('cases') },
  handler: async (ctx, { secret, caseId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.documents.listByCaseInternal, { caseId });
  },
});

export const createLetter = mutation({
  args: {
    ...secretArg,
    caseId: v.id('cases'),
    content: v.string(),
    groundingContextIds: v.optional(v.array(v.string())),
    citationValidation: v.optional(v.any()),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.letters.createInternal, a);
  },
});

export const latestLetterByCase = query({
  args: { ...secretArg, caseId: v.id('cases') },
  handler: async (ctx, { secret, caseId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.letters.latestByCaseInternal, { caseId });
  },
});

export const setLetterPdfUrl = mutation({
  args: { ...secretArg, letterId: v.id('letters'), pdfUrl: v.string() },
  handler: async (ctx, { secret, letterId, pdfUrl }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.letters.setPdfUrlInternal, { letterId, pdfUrl });
  },
});

export const createSequence = mutation({
  args: {
    ...secretArg,
    caseId: v.id('cases'),
    vertical: v.string(),
    steps: v.any(),
    nextSendAt: v.optional(v.number()),
    groundingContextIds: v.optional(v.array(v.string())),
    citationValidation: v.optional(v.any()),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.sequences.createInternal, a);
  },
});

export const latestSequenceByCase = query({
  args: { ...secretArg, caseId: v.id('cases') },
  handler: async (ctx, { secret, caseId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.sequences.latestByCaseInternal, { caseId });
  },
});

export const patchSequence = mutation({
  args: { ...secretArg, sequenceId: v.id('sequences'), patch: v.any() },
  handler: async (ctx, { secret, sequenceId, patch }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.sequences.patchInternal, { sequenceId, patch });
  },
});

export const createPacket = mutation({
  args: {
    ...secretArg,
    caseId: v.id('cases'),
    venue: v.string(),
    type: v.string(),
    bundleUrl: v.optional(v.string()),
    templateVersion: v.string(),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.packets.createInternal, a);
  },
});

export const listPacketsByCase = query({
  args: { ...secretArg, caseId: v.id('cases') },
  handler: async (ctx, { secret, caseId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.packets.listByCaseInternal, { caseId });
  },
});

/* ------------------------------------------------------------------ */
/*  deadlines                                                         */
/* ------------------------------------------------------------------ */

export const createDeadline = mutation({
  args: {
    ...secretArg,
    caseId: v.id('cases'),
    deadlineDate: v.number(),
    timezone: v.string(),
    anchorEvent: v.string(),
    promptMessage: v.string(),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.deadlines.createInternal, a);
  },
});

export const listDeadlinesByCase = query({
  args: { ...secretArg, caseId: v.id('cases') },
  handler: async (ctx, { secret, caseId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.deadlines.listByCaseInternal, { caseId });
  },
});

export const getDueDeadlines = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.deadlines.getDueInternal, {});
  },
});

export const markDeadlineFired = mutation({
  args: { ...secretArg, deadlineEventId: v.id('deadlineEvents') },
  handler: async (ctx, { secret, deadlineEventId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.deadlines.markFiredInternal, { deadlineEventId });
  },
});

export const countUpcomingDeadlines = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.deadlines.countUpcomingInternal, {});
  },
});

/* ------------------------------------------------------------------ */
/*  outcomes                                                          */
/* ------------------------------------------------------------------ */

export const listVerifiedOutcomes = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.outcomes.listVerifiedInternal, {});
  },
});

/* ------------------------------------------------------------------ */
/*  subscriptions                                                     */
/* ------------------------------------------------------------------ */

export const getSubscriptionByPaddleId = query({
  args: { ...secretArg, paddleSubscriptionId: v.string() },
  handler: async (ctx, { secret, paddleSubscriptionId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.subscriptions.getByPaddleIdInternal, { paddleSubscriptionId });
  },
});

export const createSubscription = mutation({
  args: {
    ...secretArg,
    paddleCustomerId: v.optional(v.string()),
    paddleSubscriptionId: v.string(),
    plan: v.string(),
    status: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.subscriptions.createInternal, a);
  },
});

export const patchSubscriptionByPaddleId = mutation({
  args: { ...secretArg, paddleSubscriptionId: v.string(), patch: v.any() },
  handler: async (ctx, { secret, paddleSubscriptionId, patch }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.subscriptions.patchByPaddleIdInternal, {
      paddleSubscriptionId,
      patch,
    });
  },
});

/* ------------------------------------------------------------------ */
/*  waitlist                                                          */
/* ------------------------------------------------------------------ */

export const joinWaitlist = mutation({
  args: {
    ...secretArg,
    email: v.string(),
    name: v.optional(v.string()),
    state: v.string(),
    wedge: v.union(v.literal('deposit'), v.literal('subscription')),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.waitlist.joinInternal, a);
  },
});

export const deleteWaitlistByEmail = mutation({
  args: { ...secretArg, email: v.string() },
  handler: async (ctx, { secret, email }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.waitlist.deleteByEmailInternal, { email });
  },
});

/* ------------------------------------------------------------------ */
/*  audit / webhooks                                                  */
/* ------------------------------------------------------------------ */

export const insertAudit = mutation({
  args: {
    ...secretArg,
    caseId: v.optional(v.id('cases')),
    userId: v.optional(v.id('users')),
    correlationId: v.optional(v.string()),
    generationInputsHash: v.optional(v.string()),
    groundingContextIds: v.optional(v.array(v.string())),
    modelVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    citationValidationResult: v.optional(v.any()),
    aiCost: v.optional(v.number()),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.audit.insertInternal, a);
  },
});

export const listRecentAudit = query({
  args: { ...secretArg, limit: v.optional(v.number()) },
  handler: async (ctx, { secret, limit }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.audit.listRecentInternal, { limit });
  },
});

export const countAllAudit = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.audit.countAllInternal, {});
  },
});

export const getWebhookByEventId = query({
  args: { ...secretArg, eventId: v.string() },
  handler: async (ctx, { secret, eventId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.webhooks.getByEventIdInternal, { eventId });
  },
});

export const recordWebhook = mutation({
  args: { ...secretArg, eventId: v.string(), provider: v.string(), payload: v.any() },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.webhooks.recordInternal, a);
  },
});

export const markWebhookProcessed = mutation({
  args: { ...secretArg, eventId: v.string() },
  handler: async (ctx, { secret, eventId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.webhooks.markProcessedInternal, { eventId });
  },
});

export const listRecentWebhooks = query({
  args: { ...secretArg, limit: v.optional(v.number()) },
  handler: async (ctx, { secret, limit }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.webhooks.listRecentInternal, { limit });
  },
});

export const countAllWebhooks = query({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.webhooks.countAllInternal, {});
  },
});

/* ------------------------------------------------------------------ */
/*  tavily                                                            */
/* ------------------------------------------------------------------ */

export const getTavily = query({
  args: { ...secretArg, queryHash: v.string() },
  handler: async (ctx, { secret, queryHash }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.tavily.getInternal, { queryHash });
  },
});

export const deleteTavily = mutation({
  args: { ...secretArg, queryHash: v.string() },
  handler: async (ctx, { secret, queryHash }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.tavily.deleteInternal, { queryHash });
  },
});

export const upsertTavily = mutation({
  args: {
    ...secretArg,
    queryHash: v.string(),
    domainFilter: v.optional(v.string()),
    results: v.any(),
    ttlDays: v.number(),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.tavily.upsertInternal, a);
  },
});

/* ------------------------------------------------------------------ */
/*  law monitor                                                       */
/* ------------------------------------------------------------------ */

export const createMonitorRun = mutation({
  args: { ...secretArg },
  handler: async (ctx, { secret }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.lawMonitor.createRunInternal, {});
  },
});

export const finishMonitorRun = mutation({
  args: {
    ...secretArg,
    runId: v.id('statuteMonitorRuns'),
    statutesChecked: v.number(),
    changesDetected: v.number(),
    status: v.union(v.literal('completed'), v.literal('failed')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.lawMonitor.finishRunInternal, a);
  },
});

export const listMonitorRuns = query({
  args: { ...secretArg, limit: v.optional(v.number()) },
  handler: async (ctx, { secret, limit }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.lawMonitor.listRunsInternal, { limit });
  },
});

export const isRecentlyAlerted = query({
  args: { ...secretArg, statuteId: v.string(), sinceMs: v.number() },
  handler: async (ctx, { secret, statuteId, sinceMs }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.lawMonitor.isRecentlyAlertedInternal, { statuteId, sinceMs });
  },
});

export const createAlert = mutation({
  args: {
    ...secretArg,
    runId: v.id('statuteMonitorRuns'),
    statuteId: v.string(),
    citation: v.string(),
    jurisdiction: v.string(),
    kbEntryId: v.string(),
    changeSummary: v.string(),
    changeDetails: v.any(),
    severity: v.union(v.literal('info'), v.literal('warning'), v.literal('critical')),
    confidence: v.number(),
    sourceUrls: v.array(v.string()),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.lawMonitor.createAlertInternal, a);
  },
});

export const listAlerts = query({
  args: { ...secretArg, status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { secret, status, limit }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.lawMonitor.listAlertsInternal, { status, limit });
  },
});

export const countAlertsByStatus = query({
  args: { ...secretArg, status: v.string() },
  handler: async (ctx, { secret, status }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.lawMonitor.countAlertsByStatusInternal, { status });
  },
});

export const updateAlertStatus = mutation({
  args: {
    ...secretArg,
    alertId: v.id('statuteMonitorAlerts'),
    status: v.union(v.literal('acknowledged'), v.literal('dismissed')),
    acknowledgedBy: v.optional(v.string()),
    dismissReason: v.optional(v.string()),
  },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.lawMonitor.updateAlertStatusInternal, a);
  },
});

/* ------------------------------------------------------------------ */
/*  users (email lookup + account deletion)                           */
/* ------------------------------------------------------------------ */

export const userEmailById = query({
  args: { ...secretArg, userId: v.id('users') },
  handler: async (ctx, { secret, userId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runQuery(internal.users.emailByIdInternal, { userId });
  },
});

export const deleteUser = mutation({
  args: { ...secretArg, userId: v.id('users') },
  handler: async (ctx, { secret, userId }): Promise<any> => {
    assertSecret(secret);
    return ctx.runMutation(internal.users.deleteInternal, { userId });
  },
});

/* ------------------------------------------------------------------ */
/*  R2 storage (service-gated action wrappers)                        */
/* ------------------------------------------------------------------ */

export const uploadObject = action({
  args: { ...secretArg, key: v.string(), bytes: v.bytes(), contentType: v.optional(v.string()) },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runAction(internal.storageActions.uploadInternal, a);
  },
});

export const signObject = action({
  args: { ...secretArg, key: v.string(), ttl: v.optional(v.union(v.literal('internal'), v.literal('userFacing'))) },
  handler: async (ctx, { secret, ...a }): Promise<any> => {
    assertSecret(secret);
    return ctx.runAction(internal.storageActions.signInternal, a);
  },
});

export const deleteObjects = action({
  args: { ...secretArg, keys: v.array(v.string()) },
  handler: async (ctx, { secret, keys }): Promise<any> => {
    assertSecret(secret);
    return ctx.runAction(internal.storageActions.removeInternal, { keys });
  },
});
