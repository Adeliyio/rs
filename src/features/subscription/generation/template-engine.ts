/**
 * Deterministic subscription-cancellation template engine — server-only, $0.
 *
 * Drop-in synchronous replacement for `generateSubscriptionSequence`
 * (src/lib/ai/generation.ts). Produces the identical output contract
 * (SequenceStep[], exactly 3 steps) with NO network / NO LLM call.
 *
 * Legal-safety design:
 *  - First-person framing throughout ("I am writing to request...").
 *  - Citations ONLY reference statute_ids present in the grounding set —
 *    fabrication is structurally impossible.
 *  - No evaluative language, no legal threats: the output is written to
 *    pass the existing compliance scanner (src/lib/ai/compliance-scanner.ts).
 *  - Every required element from the former LLM system prompt
 *    (email 1 a–i, email 2 a–h, email 3 a–g) is encoded as template structure.
 *
 * This module must NEVER import the OpenAI client or reference AI_CONFIG.
 */

import type { UserSituation } from '@/lib/ai/generation';
import type { SequenceStep, Citation } from '@/types/generation.types';

/* ------------------------------------------------------------------ */
/*  Placeholders (preserved for downstream replacement)               */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_NAME = '[YOUR NAME]';
const PLACEHOLDER_EMAIL = '[YOUR EMAIL]';
const PLACEHOLDER_DATE = '[DATE]';
// Back-reference to a PRIOR email the user sent — this must NOT be auto-filled
// with today's date (that produced a self-contradictory timeline, e.g. "my email
// of Sep 3" dated Sep 3). It stays a user-fillable placeholder.
const PLACEHOLDER_PRIOR_DATE = '[DATE YOU SENT THE PREVIOUS EMAIL]';

/* ------------------------------------------------------------------ */
/*  Grounding parsing                                                 */
/* ------------------------------------------------------------------ */

/**
 * A statute resolved from the grounding context: its stable id plus the
 * human-readable citation text (e.g. "15 U.S.C. §8401-8405").
 */
interface ResolvedStatute {
  statute_id: string;
  citation_text: string;
}

/** Federal statute ids, in the contract's stated ordering. */
const FEDERAL_STATUTE_IDS = [
  'rosca',
  'ftc-negative-option-rule-1973',
  'fcba',
] as const;

/**
 * Parses the assembled grounding context for `[statute_id] citation`
 * lines (the exact shape emitted by grounding.ts `formatStatutes`) and
 * returns a map of statute_id -> citation text, restricted to ids that
 * are also present in `groundingStatuteIds` (the authoritative set).
 *
 * If the citation text cannot be recovered from the context for a given
 * grounded id, the id itself is used as the citation text (conservative).
 */
/**
 * Formats a user-supplied money value for display. Users enter amounts either
 * as a bare number ("29.99") or already prefixed ("$29.99"); prepend a single
 * "$" only when one is not already present, so the output never shows "$$".
 */
function formatMoney(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
}

function parseGroundingCitations(
  groundingContext: string,
  groundingStatuteIds: string[],
): Map<string, string> {
  const grounded = new Set(groundingStatuteIds);
  const map = new Map<string, string>();

  // Match lines like:  "  [rosca] 15 U.S.C. §8401-8405"
  const linePattern = /^\s*\[([A-Za-z0-9_-]+)\]\s+(.+?)\s*$/gm;
  let match = linePattern.exec(groundingContext);
  while (match !== null) {
    const id = match[1];
    const citation = match[2];
    if (id !== undefined && citation !== undefined && grounded.has(id) && !map.has(id)) {
      map.set(id, citation.trim());
    }
    match = linePattern.exec(groundingContext);
  }

  // Ensure every grounded id has at least a fallback citation text.
  for (const id of groundingStatuteIds) {
    if (!map.has(id)) {
      map.set(id, id);
    }
  }

  return map;
}

/**
 * Selects the primary statute to cite: prefer a state statute if the
 * jurisdiction has one in the grounding set, otherwise fall back to the
 * federal statutes in the order rosca > ftc-negative-option-rule-1973 > fcba.
 *
 * Returns null only if the grounding set is empty.
 */
function selectPrimaryStatute(
  citationMap: Map<string, string>,
  groundingStatuteIds: string[],
): ResolvedStatute | null {
  const federalSet = new Set<string>(FEDERAL_STATUTE_IDS);

  // 1. Prefer the first non-federal (state) statute in the grounding set.
  for (const id of groundingStatuteIds) {
    if (!federalSet.has(id) && citationMap.has(id)) {
      return { statute_id: id, citation_text: citationMap.get(id) ?? id };
    }
  }

  // 2. Fall back to federal statutes in priority order.
  for (const id of FEDERAL_STATUTE_IDS) {
    if (citationMap.has(id)) {
      return { statute_id: id, citation_text: citationMap.get(id) ?? id };
    }
  }

  // 3. Last resort: any grounded statute at all.
  const first = groundingStatuteIds.find((id) => citationMap.has(id));
  if (first) {
    return { statute_id: first, citation_text: citationMap.get(first) ?? first };
  }

  return null;
}

/** Resolve the FCBA statute if it is grounded (used for chargeback references). */
function resolveFcba(citationMap: Map<string, string>): ResolvedStatute | null {
  if (citationMap.has('fcba')) {
    return { statute_id: 'fcba', citation_text: citationMap.get('fcba') ?? 'fcba' };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Vertical wording                                                  */
/* ------------------------------------------------------------------ */

/**
 * Per-vertical wording. Vertical affects tone/detail wording only — the
 * structure and required elements are identical across verticals. A
 * missing vertical (e.g. 'telecom', which has no KB vertical file) falls
 * back to the generic base config.
 */
interface VerticalWording {
  /** Noun used for the thing being cancelled ("membership", "subscription"). */
  serviceNoun: string;
  /** A single vertical-specific sentence added to email 1 (may be empty). */
  email1Note: string;
  /** Subject noun phrase used in subject lines ("Membership", "Subscription"). */
  subjectNoun: string;
}

const GENERIC_WORDING: VerticalWording = {
  serviceNoun: 'subscription',
  email1Note: '',
  subjectNoun: 'Subscription',
};

const VERTICAL_WORDING: Record<string, VerticalWording> = {
  gym: {
    serviceNoun: 'membership',
    subjectNoun: 'Membership',
    email1Note:
      'If my membership was initiated or its terms accepted online, I am requesting that cancellation be made available through the same medium.',
  },
  telecom: {
    serviceNoun: 'service',
    subjectNoun: 'Service',
    email1Note:
      'This request concerns the recurring service only; it is separate from any equipment I have retained.',
  },
  streaming: {
    serviceNoun: 'subscription',
    subjectNoun: 'Subscription',
    email1Note:
      'If this subscription converted from a free trial to a paid plan, I am noting that the conversion is part of this request.',
  },
  saas: {
    serviceNoun: 'subscription',
    subjectNoun: 'Subscription',
    email1Note:
      'If this plan auto-renewed, I am including the renewal charge in the scope of this request and asking that no further renewals occur.',
  },
  mobile_app: {
    serviceNoun: 'app subscription',
    subjectNoun: 'App Subscription',
    email1Note:
      'If this subscription was purchased through an app store, I am noting that platform cancellation has been requested in parallel with this message.',
  },
};

function resolveVerticalWording(vertical?: string): VerticalWording {
  if (vertical && vertical in VERTICAL_WORDING) {
    return VERTICAL_WORDING[vertical] ?? GENERIC_WORDING;
  }
  return GENERIC_WORDING;
}

/* ------------------------------------------------------------------ */
/*  Field helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * The account identifier for the letter. When the user didn't provide one, fall
 * back to a clearly-fillable placeholder (bracketed like [YOUR NAME]) that the
 * user knows to complete — NOT the awkward "[account identifier on file]" that
 * read as a broken template artifact in a ready-to-send email.
 */
function accountIdentifierLine(situation: UserSituation): string {
  return (
    situation.account_identifier ??
    situation.billing_email ??
    '[YOUR ACCOUNT NUMBER OR BILLING EMAIL]'
  );
}

/** Human-readable effective-date phrase. */
function effectiveDatePhrase(situation: UserSituation): string {
  if (situation.cancellation_effective_date === 'immediately') {
    return 'effective immediately, with all recurring charges to stop now';
  }
  if (situation.cancellation_effective_date === 'end_of_period') {
    return 'effective at the end of the current billing period, with no further renewals';
  }
  if (situation.cancellation_effective_date) {
    return `effective ${situation.cancellation_effective_date}`;
  }
  return 'effective immediately, with all recurring charges to stop';
}

/**
 * Joins body blocks into a professionally-spaced letter.
 *
 * Each non-empty block is a paragraph and is separated from the next by a blank
 * line (`\n\n`) — the standard business-letter look. The builders also push
 * empty-string markers between blocks; these are now redundant (every block is
 * already its own paragraph) but harmless — they collapse away here.
 *
 * The salutation ("Dear …,") and the sign-off lines ("Sincerely," / name /
 * email / date) are the exception: those must sit on their own single-spaced
 * lines within their block, not spread into separate paragraphs. Builders keep
 * the salutation as one block and the sign-off arrives as a single pre-joined
 * block (see `signOff`), so paragraph-per-block spacing is correct throughout.
 *
 * The previous implementation dropped every blank AND joined with a single
 * "\n", collapsing the whole letter into a single-spaced wall of text — the
 * "tardy" formatting this replaces.
 */
function joinLines(lines: string[]): string {
  return lines
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .join('\n\n')
    // Collapse a doubled sentence period that occurs when a user-supplied value
    // already ends in "." (e.g. "Acme Inc." + template's ".") — but leave an
    // ellipsis ("...") intact. Matches exactly ".." followed by space/newline/end.
    .replace(/(?<!\.)\.\.(?=\s|$)/g, '.');
}

/* ------------------------------------------------------------------ */
/*  Email 1 — Formal Cancellation Demand (Day 0)                      */
/* ------------------------------------------------------------------ */

function buildEmail1Body(
  situation: UserSituation,
  wording: VerticalWording,
  primary: ResolvedStatute | null,
): string {
  const account = accountIdentifierLine(situation);
  const blocks: string[] = [];

  // (a) address the company by name
  blocks.push(`Dear ${situation.company_name},`);
  blocks.push('');

  // Opening — first person, (b) account identifier, service noun
  blocks.push(
    `I am writing to request cancellation of my ${wording.serviceNoun} with ${situation.company_name}. My account is identified as ${account}.`,
  );
  blocks.push('');

  // (d) requested cancellation effective date
  blocks.push(
    `I am requesting that this cancellation be made ${effectiveDatePhrase(situation)}.`,
  );

  // (c) revoke authorization for future charges (verbatim required phrase)
  blocks.push(
    'I am revoking authorization for any future charges to my payment method.',
  );

  // (e) cite the primary applicable statute from grounding
  if (primary) {
    blocks.push(
      `The applicable consumer protection provision is ${primary.citation_text}, which addresses cancellation of recurring subscriptions.`,
    );
  }

  // vertical-specific note (tone/detail only)
  if (wording.email1Note.length > 0) {
    blocks.push(wording.email1Note);
  }

  blocks.push('');

  // (h) prior cancellation attempt reference
  const priorLine = buildPriorAttemptLine(situation);
  if (priorLine.length > 0) {
    blocks.push(priorLine);
    blocks.push('');
  }

  // (g) refund request: amount + basis
  const refundLine = buildRefundLine(situation);
  if (refundLine.length > 0) {
    blocks.push(refundLine);
    blocks.push('');
  }

  // (f) written confirmation within 7 business days — three specifics
  blocks.push(
    'I am requesting written confirmation within 7 business days that: (i) the subscription is cancelled; (ii) auto-renewal is disabled; and (iii) no further charges will be made to the payment method on file.',
  );
  blocks.push('');

  // (i) sign off with placeholders
  blocks.push(...signOff());

  return joinLines(blocks);
}

/* ------------------------------------------------------------------ */
/*  Email 2 — Follow-Up with Escalation (Day 7)                       */
/* ------------------------------------------------------------------ */

function buildEmail2Body(
  situation: UserSituation,
  wording: VerticalWording,
  primary: ResolvedStatute | null,
  fcba: ResolvedStatute | null,
  regulator: string,
): string {
  const account = accountIdentifierLine(situation);
  const blocks: string[] = [];

  blocks.push(`Dear ${situation.company_name},`);
  blocks.push('');

  // (a) reference "my email of [DATE]"; (b) note lack of response
  blocks.push(
    `I am following up on my email of ${PLACEHOLDER_PRIOR_DATE} regarding cancellation of my ${wording.serviceNoun}. As of today I have not received the written confirmation I requested.`,
  );

  // (c) restate account id
  blocks.push(`For reference, my account is identified as ${account}.`);
  blocks.push('');

  // restate the primary provision (keeps a grounded citation in this step)
  if (primary) {
    blocks.push(
      `My cancellation request remains grounded in ${primary.citation_text}.`,
    );
  }

  // (d) charges since email 1, if any
  const chargesLine = buildChargesSinceLine(situation);
  if (chargesLine.length > 0) {
    blocks.push(chargesLine);
  }
  blocks.push('');

  // (e) name the regulatory agency the complaint would be filed with
  blocks.push(
    `If I do not receive confirmation, I intend to file a complaint with ${regulator}.`,
  );

  // (f) FCBA chargeback rights
  if (fcba) {
    blocks.push(
      `For any charges made after my cancellation request, I intend to dispute them with my card issuer under ${fcba.citation_text}.`,
    );
  } else {
    blocks.push(
      'For any charges made after my cancellation request, I intend to dispute them with my card issuer under the Fair Credit Billing Act.',
    );
  }
  blocks.push('');

  // (g) firm 7-day deadline
  blocks.push(
    `I am requesting written confirmation of cancellation within 7 days of the date of this email.`,
  );
  blocks.push('');

  // (h) sign off
  blocks.push(...signOff());

  return joinLines(blocks);
}

/* ------------------------------------------------------------------ */
/*  Email 3 — Final Notice (Day 14)                                   */
/* ------------------------------------------------------------------ */

function buildEmail3Body(
  situation: UserSituation,
  wording: VerticalWording,
  primary: ResolvedStatute | null,
  includeCfpb: boolean,
): string {
  const account = accountIdentifierLine(situation);
  const blocks: string[] = [];

  blocks.push(`Dear ${situation.company_name},`);
  blocks.push('');

  // (a) reference both prior emails by date
  blocks.push(
    `This is my final written request regarding cancellation of my ${wording.serviceNoun}, following my email of ${PLACEHOLDER_PRIOR_DATE} and my subsequent follow-up of ${PLACEHOLDER_PRIOR_DATE}. My account is identified as ${account}.`,
  );
  blocks.push('');

  // (b) final written request before a regulatory complaint
  blocks.push(
    'This is the final written request I am sending before filing a complaint with the relevant regulatory agency.',
  );

  // (c) FTC complaint URL + CFPB if applicable
  if (includeCfpb) {
    blocks.push(
      'I intend to file a complaint with the Federal Trade Commission at ftc.gov/complaint and, as applicable, with the Consumer Financial Protection Bureau at consumerfinance.gov/complaint.',
    );
  } else {
    blocks.push(
      'I intend to file a complaint with the Federal Trade Commission at ftc.gov/complaint.',
    );
  }
  blocks.push('');

  // (d) charges after cancellation will be disputed with card issuer
  blocks.push(
    'Any charges made after my original cancellation request will be disputed with my card issuer.',
  );

  // (e) cite the applicable statute once more
  if (primary) {
    blocks.push(
      `My request continues to rest on ${primary.citation_text}.`,
    );
  }
  blocks.push('');

  // (f) request immediate written confirmation
  blocks.push(
    'I am requesting immediate written confirmation that the subscription is cancelled and that no further charges will be made.',
  );
  blocks.push('');

  // (g) sign off
  blocks.push(...signOff());

  return joinLines(blocks);
}

/* ------------------------------------------------------------------ */
/*  Conditional block builders                                        */
/* ------------------------------------------------------------------ */

function buildRefundLine(situation: UserSituation): string {
  if (!situation.wants_refund) {
    return '';
  }
  // Only assert the "after my cancellation request" basis when the user ACTUALLY
  // made a prior cancellation attempt — otherwise it's a false, rebuttable claim
  // (a refund can be owed for reasons needing no prior cancel, e.g. auto-renewed
  // without consent). Mirrors the guard in buildChargesSinceLine.
  const hadPriorAttempt = Boolean(situation.previous_cancellation_date);

  const amount = situation.refund_amount
    ? formatMoney(situation.refund_amount)
    : hadPriorAttempt
      ? 'the amount charged after my cancellation request'
      : 'the improper recurring charge(s)';

  let basis: string;
  if (situation.refund_reason) {
    basis = ` The basis for this request is: ${situation.refund_reason}.`;
  } else if (hadPriorAttempt) {
    basis = ' The basis for this request is that the charge was made after my cancellation request.';
  } else {
    basis = '';
  }
  return `I am also requesting a refund of ${amount}.${basis}`;
}

function buildPriorAttemptLine(situation: UserSituation): string {
  const hasPrior =
    Boolean(situation.previous_cancellation_date) ||
    Boolean(situation.previous_cancellation_method) ||
    Boolean(situation.previous_cancellation_result);
  if (!hasPrior) {
    return '';
  }

  const parts: string[] = [];
  if (situation.previous_cancellation_date) {
    parts.push(`on ${situation.previous_cancellation_date}`);
  }
  if (situation.previous_cancellation_method) {
    parts.push(`via ${situation.previous_cancellation_method}`);
  }

  const attemptClause =
    parts.length > 0
      ? `I previously attempted to cancel ${parts.join(' ')}.`
      : 'I previously attempted to cancel this subscription.';

  const resultClause = situation.previous_cancellation_result
    ? ` The result of that attempt was: ${situation.previous_cancellation_result}.`
    : '';

  return `${attemptClause}${resultClause}`;
}

function buildChargesSinceLine(situation: UserSituation): string {
  if (!situation.wants_refund && !situation.last_charge_date) {
    return '';
  }
  const amount = situation.monthly_charge ? formatMoney(situation.monthly_charge) : 'the recurring amount';

  // Only assert the charge came "after my cancellation request" when the user
  // ACTUALLY made a prior cancellation attempt — otherwise that is a false,
  // rebuttable statement to the counterparty. With no prior attempt, state the
  // charge neutrally.
  const hadPriorAttempt = Boolean(situation.previous_cancellation_date);

  if (situation.last_charge_date) {
    return hadPriorAttempt
      ? `A charge of ${amount} was recorded on ${situation.last_charge_date}, after my cancellation request.`
      : `The most recent charge on record is ${amount}, on ${situation.last_charge_date}.`;
  }
  return hadPriorAttempt
    ? `A charge of ${amount} has been recorded since my cancellation request.`
    : `A recurring charge of ${amount} remains on the account.`;
}

/* ------------------------------------------------------------------ */
/*  Sign-off (shared)                                                 */
/* ------------------------------------------------------------------ */

function signOff(): string[] {
  // The signature is ONE block: "Sincerely," and the placeholder lines stack
  // tightly (single line breaks), separated from the letter body by the usual
  // paragraph gap that joinLines adds around this block. Returning them as
  // separate blocks would scatter the signature into four spaced-out paragraphs.
  return [
    ['Sincerely,', PLACEHOLDER_NAME, PLACEHOLDER_EMAIL, PLACEHOLDER_DATE].join('\n'),
  ];
}

/* ------------------------------------------------------------------ */
/*  Regulator selection                                               */
/* ------------------------------------------------------------------ */

/**
 * Names the regulatory agency for email 2. State jurisdictions name the
 * state Attorney General; federal-only names the FTC. Deterministic from
 * the primary statute id (state statute => state AG).
 */
function selectRegulator(primary: ResolvedStatute | null): string {
  if (!primary) {
    return 'the Federal Trade Commission';
  }
  if (primary.statute_id.startsWith('ca-')) {
    return 'the California Attorney General';
  }
  if (primary.statute_id.startsWith('ny-')) {
    return 'the New York Attorney General';
  }
  const federalSet = new Set<string>(FEDERAL_STATUTE_IDS);
  if (!federalSet.has(primary.statute_id)) {
    // Some other state statute id — name the state AG generically.
    return 'the state Attorney General';
  }
  return 'the Federal Trade Commission';
}

/* ------------------------------------------------------------------ */
/*  Subject lines                                                     */
/* ------------------------------------------------------------------ */

function buildSubjects(
  situation: UserSituation,
  wording: VerticalWording,
): [string, string, string] {
  const account = accountIdentifierLine(situation);
  return [
    `Formal Request to Cancel ${wording.subjectNoun} — ${situation.company_name} — ${account}`,
    `Second Request — Cancellation of ${wording.subjectNoun} — ${situation.company_name} — ${account}`,
    `Final Notice — Cancellation of ${wording.subjectNoun} Unresolved — ${situation.company_name} — ${account}`,
  ];
}

/* ------------------------------------------------------------------ */
/*  Citations for a step                                              */
/* ------------------------------------------------------------------ */

/**
 * Builds the Citation[] for a step from a set of statute ids, filtering
 * to the grounded set so fabrication is impossible.
 */
function buildCitations(
  ids: string[],
  citationMap: Map<string, string>,
): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];
  for (const id of ids) {
    if (citationMap.has(id) && !seen.has(id)) {
      seen.add(id);
      citations.push({
        statute_id: id,
        citation_text: citationMap.get(id) ?? id,
        is_grounded: true,
      });
    }
  }
  return citations;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates a 3-step subscription cancellation email sequence from
 * deterministic templates — a synchronous, $0 drop-in replacement for
 * `generateSubscriptionSequence`.
 *
 * @param groundingContext     Assembled grounding context string.
 * @param groundingStatuteIds  Statute ids present in the grounding context.
 * @param userSituation        Details about the user's cancellation situation.
 * @param vertical             Optional vertical (gym | telecom | streaming | saas | mobile_app).
 * @param _strict              Accepted for signature compatibility; templates are
 *                             always strict, so this is a no-op.
 * @returns                    Exactly 3 SequenceStep objects.
 */
export function generateSubscriptionSequenceFromTemplates(
  groundingContext: string,
  groundingStatuteIds: string[],
  userSituation: UserSituation,
  vertical?: string,
  _strict?: boolean,
): SequenceStep[] {
  const citationMap = parseGroundingCitations(groundingContext, groundingStatuteIds);
  const primary = selectPrimaryStatute(citationMap, groundingStatuteIds);
  const fcba = resolveFcba(citationMap);
  const wording = resolveVerticalWording(vertical);
  const regulator = selectRegulator(primary);
  const includeCfpb = citationMap.has('cfpb') || citationMap.has('fcba');

  const [subject1, subject2, subject3] = buildSubjects(userSituation, wording);

  // Statute ids cited per step (only grounded ids survive buildCitations).
  const primaryId = primary ? [primary.statute_id] : [];
  const fcbaId = fcba ? [fcba.statute_id] : [];

  const step1: SequenceStep = {
    step_number: 1,
    name: 'Formal Cancellation Demand',
    subject: subject1,
    body: buildEmail1Body(userSituation, wording, primary),
    timing_description: 'Send immediately (Day 0)',
    citations: buildCitations(primaryId, citationMap),
  };

  const step2: SequenceStep = {
    step_number: 2,
    name: 'Follow-Up with Escalation Notice',
    subject: subject2,
    body: buildEmail2Body(userSituation, wording, primary, fcba, regulator),
    timing_description: 'Send on Day 7 if no response',
    citations: buildCitations([...primaryId, ...fcbaId], citationMap),
  };

  const step3: SequenceStep = {
    step_number: 3,
    name: 'Final Notice Before Regulatory Complaint',
    subject: subject3,
    body: buildEmail3Body(userSituation, wording, primary, includeCfpb),
    timing_description: 'Send on Day 14 if still no response',
    citations: buildCitations(primaryId, citationMap),
  };

  return [step1, step2, step3];
}

/* ------------------------------------------------------------------ */
/*  Exports for testing                                               */
/* ------------------------------------------------------------------ */

export {
  parseGroundingCitations,
  selectPrimaryStatute,
  resolveVerticalWording,
  selectRegulator,
};
