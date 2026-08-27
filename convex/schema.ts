import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

/**
 * Convex schema — faithful translation of the former Supabase Postgres schema.
 *
 * Key differences from the SQL version:
 * - Postgres enums → union literals (v.union(v.literal(...))).
 * - jsonb columns → v.any() (read/written as whole values, never path-queried).
 * - uuid PKs → Convex document _id (auto). Foreign keys → v.id('<table>').
 * - `created_at`/`updated_at` → we keep explicit numeric millisecond fields
 *   (createdAt/updatedAt) rather than relying on Convex's _creationTime, because
 *   several queries order by updated_at and filter by date ranges.
 * - RLS is GONE. Row ownership is enforced in every query/mutation via the
 *   helpers in convex/lib/authz.ts. `user_id` becomes `userId: v.id('users')`.
 * - The former `auth.users` table is replaced by Convex Auth's `users` table
 *   (provided by `authTables`).
 *
 * Field names use camelCase on the Convex side; the API/route layer maps to the
 * snake_case shapes the existing frontend expects.
 */

/* ------------------------------------------------------------------ */
/*  Enum unions (mirror 00001 + 00008)                                */
/* ------------------------------------------------------------------ */

const caseStatus = v.union(
  v.literal('intake'),
  v.literal('generated'),
  v.literal('sent'),
  v.literal('awaiting'),
  v.literal('escalation_drafted'),
  v.literal('resolved'),
  v.literal('closed'),
);

const paymentStatus = v.union(
  v.literal('pending'),
  v.literal('paid'),
  v.literal('refunded'),
);

const parseStatus = v.union(
  v.literal('pending'),
  v.literal('parsed'),
  v.literal('confirmed'),
  v.literal('failed'),
);

const wedgeType = v.union(v.literal('deposit'), v.literal('subscription'));

const monitorRunStatus = v.union(
  v.literal('running'),
  v.literal('completed'),
  v.literal('failed'),
);

const alertSeverity = v.union(
  v.literal('info'),
  v.literal('warning'),
  v.literal('critical'),
);

const alertStatus = v.union(
  v.literal('new'),
  v.literal('acknowledged'),
  v.literal('dismissed'),
);

export default defineSchema({
  // Convex Auth tables (users, authAccounts, authSessions, authVerificationCodes,
  // authRefreshTokens, authVerifiers, authRateLimits). `users` replaces auth.users.
  ...authTables,

  /* ---------------------------------------------------------------- */
  /*  cases                                                           */
  /* ---------------------------------------------------------------- */
  cases: defineTable({
    userId: v.id('users'),
    status: caseStatus,
    wedge: wedgeType,
    jurisdiction: v.string(),
    diagnosticState: v.optional(v.any()), // jsonb
    paymentStatus: paymentStatus,
    polarOrderId: v.optional(v.string()),
    previewShownAt: v.optional(v.number()),
    refusalTrigger: v.optional(v.string()),
    totalAiCost: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()), // soft delete
  })
    .index('by_user', ['userId'])
    .index('by_user_payment', ['userId', 'paymentStatus'])
    // Replaces the partial-unique index uq_active_case; uniqueness is enforced
    // in the createCase mutation (Convex has no partial unique constraints).
    .index('by_user_wedge_jurisdiction', ['userId', 'wedge', 'jurisdiction'])
    .index('by_polar_order_id', ['polarOrderId'])
    .index('by_status', ['status']),

  /* ---------------------------------------------------------------- */
  /*  documents                                                       */
  /* ---------------------------------------------------------------- */
  documents: defineTable({
    caseId: v.id('cases'),
    // R2 object key (was Supabase Storage path). {userId}/{caseId}/{filename}
    filePath: v.string(),
    contentType: v.optional(v.string()),
    parseStatus: parseStatus,
    parsedJson: v.optional(v.any()),
    confirmedJson: v.optional(v.any()),
    authenticityAck: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index('by_case', ['caseId']),

  /* ---------------------------------------------------------------- */
  /*  letters                                                         */
  /* ---------------------------------------------------------------- */
  letters: defineTable({
    caseId: v.id('cases'),
    content: v.string(),
    pdfUrl: v.optional(v.string()), // R2 object key
    groundingContextIds: v.optional(v.array(v.string())),
    citationValidation: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index('by_case', ['caseId']),

  /* ---------------------------------------------------------------- */
  /*  sequences                                                       */
  /* ---------------------------------------------------------------- */
  sequences: defineTable({
    caseId: v.id('cases'),
    vertical: v.string(),
    currentStep: v.number(),
    nextSendAt: v.optional(v.number()),
    steps: v.any(), // jsonb (NOT NULL)
    groundingContextIds: v.optional(v.array(v.string())),
    citationValidation: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index('by_case', ['caseId']),

  /* ---------------------------------------------------------------- */
  /*  packets                                                         */
  /* ---------------------------------------------------------------- */
  packets: defineTable({
    caseId: v.id('cases'),
    venue: v.string(),
    type: v.string(),
    bundleUrl: v.optional(v.string()), // R2 object key
    templateVersion: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index('by_case', ['caseId']),

  /* ---------------------------------------------------------------- */
  /*  deadline_events                                                 */
  /* ---------------------------------------------------------------- */
  deadlineEvents: defineTable({
    caseId: v.id('cases'),
    deadlineDate: v.number(), // was date; store as ms timestamp
    timezone: v.string(),
    anchorEvent: v.string(),
    promptMessage: v.string(),
    firedAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_case', ['caseId'])
    // Replaces idx_deadline_events_date WHERE fired_at IS NULL — we filter
    // fired/dismissed in code; index keeps the date scan cheap.
    .index('by_deadline_date', ['deadlineDate']),

  /* ---------------------------------------------------------------- */
  /*  case_status_history                                             */
  /* ---------------------------------------------------------------- */
  caseStatusHistory: defineTable({
    caseId: v.id('cases'),
    previousStatus: caseStatus,
    newStatus: caseStatus,
    changedAt: v.number(),
  }).index('by_case', ['caseId']),

  /* ---------------------------------------------------------------- */
  /*  outcomes                                                        */
  /* ---------------------------------------------------------------- */
  outcomes: defineTable({
    caseId: v.id('cases'), // UNIQUE in SQL — enforced via by_case lookup + upsert
    stage: v.string(),
    outcomeCategory: v.string(),
    recoveredAmount: v.optional(v.number()),
    testimonial: v.optional(v.string()),
    consent: v.optional(v.any()),
    outcomeVerified: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_case', ['caseId']),

  /* ---------------------------------------------------------------- */
  /*  subscriptions                                                   */
  /* ---------------------------------------------------------------- */
  subscriptions: defineTable({
    // NOTE: under Supabase this stored Polar's customer_id (a string), NOT the
    // app user uuid — a pre-existing quirk. In Convex, userId must be a real
    // users id, so we keep the Polar customer id in `polarCustomerId` and set
    // `userId` only when it can be resolved to an app user. Reads tolerate an
    // absent userId.
    userId: v.optional(v.id('users')),
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.string(), // UNIQUE — enforced via index lookup
    plan: v.string(),
    status: v.string(),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_polar_subscription_id', ['polarSubscriptionId']),

  /* ---------------------------------------------------------------- */
  /*  waitlist_entries                                                */
  /* ---------------------------------------------------------------- */
  waitlistEntries: defineTable({
    email: v.string(),
    name: v.optional(v.string()), // added in 00009
    state: v.string(),
    wedge: wedgeType,
    createdAt: v.number(),
  })
    // Replaces uq_waitlist_email_state_wedge; uniqueness enforced in mutation.
    .index('by_email_state_wedge', ['email', 'state', 'wedge'])
    .index('by_state_wedge', ['state', 'wedge'])
    .index('by_email', ['email']),

  /* ---------------------------------------------------------------- */
  /*  audit_log                                                       */
  /* ---------------------------------------------------------------- */
  auditLog: defineTable({
    caseId: v.optional(v.id('cases')),
    userId: v.optional(v.id('users')),
    correlationId: v.optional(v.string()), // UNIQUE — enforced in insert
    generationInputsHash: v.optional(v.string()),
    groundingContextIds: v.optional(v.array(v.string())),
    modelVersion: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    citationValidationResult: v.optional(v.any()),
    aiCost: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_case', ['caseId'])
    .index('by_correlation', ['correlationId'])
    .index('by_created_at', ['createdAt']),

  /* ---------------------------------------------------------------- */
  /*  webhook_events                                                  */
  /* ---------------------------------------------------------------- */
  webhookEvents: defineTable({
    eventId: v.string(), // UNIQUE — idempotency key, enforced via index lookup
    provider: v.string(),
    payload: v.any(),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_event_id', ['eventId'])
    .index('by_created_at', ['createdAt']),

  /* ---------------------------------------------------------------- */
  /*  tavily_cache                                                    */
  /* ---------------------------------------------------------------- */
  tavilyCache: defineTable({
    queryHash: v.string(), // UNIQUE — enforced via index lookup
    domainFilter: v.optional(v.string()),
    results: v.any(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  }).index('by_query_hash', ['queryHash']),

  /* ---------------------------------------------------------------- */
  /*  login_attempts                                                  */
  /* ---------------------------------------------------------------- */
  loginAttempts: defineTable({
    userId: v.optional(v.id('users')),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
    success: v.boolean(),
    attemptedAt: v.number(),
  })
    .index('by_ip', ['ipAddress'])
    // Supports the retention-cleanup cron (delete attempts older than 30 days).
    .index('by_attempted_at', ['attemptedAt']),

  /* ---------------------------------------------------------------- */
  /*  statute_monitor_runs                                            */
  /* ---------------------------------------------------------------- */
  statuteMonitorRuns: defineTable({
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    statutesChecked: v.number(),
    changesDetected: v.number(),
    status: monitorRunStatus,
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_status_started', ['status', 'startedAt']),

  /* ---------------------------------------------------------------- */
  /*  statute_monitor_alerts                                          */
  /* ---------------------------------------------------------------- */
  statuteMonitorAlerts: defineTable({
    runId: v.id('statuteMonitorRuns'),
    statuteId: v.string(),
    citation: v.string(),
    jurisdiction: v.string(),
    kbEntryId: v.string(),
    changeSummary: v.string(),
    changeDetails: v.any(),
    severity: alertSeverity,
    confidence: v.number(),
    sourceUrls: v.array(v.string()),
    status: alertStatus,
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.string()),
    dismissReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_run', ['runId'])
    .index('by_statute_created', ['statuteId', 'createdAt']),
});
