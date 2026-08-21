import type { Doc } from '../_generated/dataModel';

/**
 * Serializers: Convex documents (camelCase, ms timestamps, _id) → the
 * snake_case row shapes the existing Next.js frontend + route layer expect.
 *
 * The migration keeps the API/consumer contracts identical (CaseRow,
 * SequenceRow, etc. in src/) so we don't have to rename fields across dozens
 * of components. Every user-facing Convex query returns one of these shapes.
 *
 * Timestamp convention: the old Postgres columns were ISO-8601 timestamptz
 * strings. We store ms-since-epoch numbers in Convex and convert back to ISO
 * strings here so downstream date parsing is unchanged. `date`-typed columns
 * (deadline_date) also round-trip as ISO strings.
 */

function iso(ms: number | undefined | null): string | null {
  return ms === undefined || ms === null ? null : new Date(ms).toISOString();
}

/* ------------------------------------------------------------------ */
/*  cases                                                             */
/* ------------------------------------------------------------------ */

export function serializeCase(doc: Doc<'cases'>) {
  return {
    id: doc._id,
    user_id: doc.userId,
    status: doc.status,
    wedge: doc.wedge,
    jurisdiction: doc.jurisdiction,
    diagnostic_state: doc.diagnosticState ?? null,
    payment_status: doc.paymentStatus,
    paddle_transaction_id: doc.paddleTransactionId ?? null,
    preview_shown_at: iso(doc.previewShownAt),
    refusal_trigger: doc.refusalTrigger ?? null,
    total_ai_cost: doc.totalAiCost,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
    deleted_at: iso(doc.deletedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  documents                                                         */
/* ------------------------------------------------------------------ */

export function serializeDocument(doc: Doc<'documents'>) {
  return {
    id: doc._id,
    case_id: doc.caseId,
    file_path: doc.filePath,
    content_type: doc.contentType ?? null,
    parse_status: doc.parseStatus,
    parsed_json: doc.parsedJson ?? null,
    confirmed_json: doc.confirmedJson ?? null,
    authenticity_ack: doc.authenticityAck,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
    deleted_at: iso(doc.deletedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  letters                                                           */
/* ------------------------------------------------------------------ */

export function serializeLetter(doc: Doc<'letters'>) {
  return {
    id: doc._id,
    case_id: doc.caseId,
    content: doc.content,
    pdf_url: doc.pdfUrl ?? null,
    grounding_context_ids: doc.groundingContextIds ?? null,
    citation_validation: doc.citationValidation ?? null,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
    deleted_at: iso(doc.deletedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  sequences                                                         */
/* ------------------------------------------------------------------ */

export function serializeSequence(doc: Doc<'sequences'>) {
  return {
    id: doc._id,
    case_id: doc.caseId,
    vertical: doc.vertical,
    current_step: doc.currentStep,
    next_send_at: iso(doc.nextSendAt),
    steps: doc.steps,
    grounding_context_ids: doc.groundingContextIds ?? null,
    citation_validation: doc.citationValidation ?? null,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
    deleted_at: iso(doc.deletedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  packets                                                           */
/* ------------------------------------------------------------------ */

export function serializePacket(doc: Doc<'packets'>) {
  return {
    id: doc._id,
    case_id: doc.caseId,
    venue: doc.venue,
    type: doc.type,
    bundle_url: doc.bundleUrl ?? null,
    template_version: doc.templateVersion,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
    deleted_at: iso(doc.deletedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  deadline_events                                                   */
/* ------------------------------------------------------------------ */

export function serializeDeadlineEvent(doc: Doc<'deadlineEvents'>) {
  return {
    id: doc._id,
    case_id: doc.caseId,
    deadline_date: iso(doc.deadlineDate),
    timezone: doc.timezone,
    anchor_event: doc.anchorEvent,
    prompt_message: doc.promptMessage,
    fired_at: iso(doc.firedAt),
    dismissed_at: iso(doc.dismissedAt),
    created_at: iso(doc.createdAt),
  };
}

/* ------------------------------------------------------------------ */
/*  case_status_history                                               */
/* ------------------------------------------------------------------ */

export function serializeStatusHistory(doc: Doc<'caseStatusHistory'>) {
  return {
    id: doc._id,
    case_id: doc.caseId,
    previous_status: doc.previousStatus,
    new_status: doc.newStatus,
    changed_at: iso(doc.changedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  outcomes                                                          */
/* ------------------------------------------------------------------ */

export function serializeOutcome(doc: Doc<'outcomes'>) {
  return {
    id: doc._id,
    case_id: doc.caseId,
    stage: doc.stage,
    outcome_category: doc.outcomeCategory,
    recovered_amount: doc.recoveredAmount ?? null,
    testimonial: doc.testimonial ?? null,
    consent: doc.consent ?? null,
    outcome_verified: doc.outcomeVerified,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
  };
}

/* ------------------------------------------------------------------ */
/*  subscriptions                                                     */
/* ------------------------------------------------------------------ */

export function serializeSubscription(doc: Doc<'subscriptions'>) {
  return {
    id: doc._id,
    user_id: doc.userId ?? doc.paddleCustomerId ?? null,
    paddle_customer_id: doc.paddleCustomerId ?? null,
    paddle_subscription_id: doc.paddleSubscriptionId,
    plan: doc.plan,
    status: doc.status,
    current_period_start: iso(doc.currentPeriodStart),
    current_period_end: iso(doc.currentPeriodEnd),
    cancel_at_period_end: doc.cancelAtPeriodEnd,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
  };
}
