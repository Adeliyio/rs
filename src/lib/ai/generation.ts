/**
 * Subscription sequence generation — server-only.
 *
 * Calls GPT-4o to generate a 3-step cancellation email sequence
 * grounded in the assembled KB context. The system prompt enforces
 * compliance constraints: first-person framing, grounded citations
 * only, no evaluative language.
 */

import { getOpenAIClient } from '@/lib/ai/openai-client';
import { AI_CONFIG } from '@/config/ai.config';
import {
  sanitizeShortField,
  sanitizeLongField,
  wrapUserData,
  PROMPT_INJECTION_GUARD,
} from '@/lib/ai/prompt-sanitizer';
import type { SequenceStep, Citation } from '@/types/generation.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface UserSituation {
  company_name: string;
  service_type: string;
  account_identifier?: string;
  billing_email?: string;
  monthly_charge?: string;
  billing_frequency?: string;
  last_charge_date?: string;
  cancellation_effective_date?: string;
  previous_cancellation_date?: string;
  previous_cancellation_method?: string;
  previous_cancellation_result?: string;
  wants_refund?: boolean;
  refund_amount?: string;
  refund_reason?: string;
  cancellation_barriers: string[];
  additional_details?: string;
}

interface GeneratedEmailStep {
  step_number: number;
  name: string;
  subject: string;
  body: string;
  timing_description: string;
  cited_statute_ids: string[];
}

interface GenerationResponse {
  emails: GeneratedEmailStep[];
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                     */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(groundingContext: string): string {
  return `You are a writing assistant that drafts subscription cancellation emails on behalf of consumers. You generate three-step email sequences that are professional, factual, and grounded in verified consumer protection law.

CRITICAL RULES — you must follow ALL of these:

1. FIRST PERSON: Every email is written in the first person ("I am writing to request...", "I am requesting..."). These are emails FROM the consumer TO the company. Never use third-person framing.

2. GROUNDED CITATIONS ONLY: You may ONLY reference statutes, rules, and legal provisions that appear in the GROUNDING CONTEXT below. Do NOT fabricate, invent, or hallucinate any legal citation. If a statute is not in the grounding context, do not reference it. Use the exact citation text from the grounding context.

3. NO EVALUATIVE LANGUAGE: Never use phrases that evaluate the user's case or predict outcomes. Prohibited examples: "strong case", "weak case", "likely to win", "guaranteed", "will recover", "you should", "I recommend", "we recommend", "you are entitled", "your rights", "you have a case", "legal advice". Instead, describe what the law provides and what the consumer is requesting.

4. NO LEGAL THREATS: Do not threaten lawsuits or use phrases like "my lawyer", "legal action", "sue", "I will take you to court", "you are violating my rights". Instead, reference specific regulatory complaint processes and chargeback rights.

5. TONE PROGRESSION: Email 1 is professional and firm. Email 2 is firm with escalation undertone. Email 3 is final-notice firm but not aggressive or threatening.

6. EMAIL 1 — FORMAL CANCELLATION DEMAND (Day 0) must include ALL of the following:
   a. Address the company by name from the user situation (e.g. "Dear Planet Fitness," — never "Dear The Company")
   b. State the account identifier (customer ID, username, or billing email) provided in the user data
   c. Explicitly state: "I am revoking authorization for any future charges to my payment method"
   d. State the requested cancellation effective date from the user data (immediately or end of billing period)
   e. Cite the primary applicable statute from the grounding context
   f. Request written confirmation within 7 business days that: (i) the subscription is cancelled, (ii) auto-renewal is disabled, (iii) no further charges will be made to the payment method on file
   g. If user data includes a refund request: state the refund amount and basis (e.g. "charged after cancellation request on [date]")
   h. If user data includes a previous cancellation attempt: reference the date, method, and result
   i. Sign off with [YOUR NAME], [YOUR EMAIL], [DATE] — these placeholders will be replaced automatically

7. EMAIL 2 — FOLLOW-UP WITH ESCALATION (Day 7) must include ALL of the following:
   a. Reference Email 1 by mentioning "my email of [DATE]" (use [DATE] placeholder for the original send date)
   b. Note the lack of response or confirmation
   c. Restate the account identifier
   d. If any charges occurred since Email 1, reference them with amounts and dates from user data
   e. Name the specific regulatory agency the complaint will be filed with (FTC for federal, state AG for state-specific)
   f. Reference credit card chargeback rights under the Fair Credit Billing Act if charges continued
   g. Set a firm 7-day deadline for response
   h. Sign off with [YOUR NAME], [YOUR EMAIL], [DATE]

8. EMAIL 3 — FINAL NOTICE (Day 14) must include ALL of the following:
   a. Reference both previous emails by date
   b. State this is the final written request before filing a regulatory complaint
   c. Provide the specific FTC complaint URL (ftc.gov/complaint) and, if applicable, the CFPB URL (consumerfinance.gov/complaint)
   d. State that all charges made after the original cancellation request will be disputed with the credit card issuer
   e. Reference the applicable statute one final time
   f. Request immediate written confirmation of cancellation
   g. Sign off with [YOUR NAME], [YOUR EMAIL], [DATE]

9. USE ALL USER DATA: The user message contains specific details about their situation — account identifiers, charge amounts, dates, prior cancellation attempts, refund requests. Use ALL of this data to make each email specific to their situation. Generic emails are not acceptable. Every available data point from the user situation must appear in the emails where relevant.

GROUNDING CONTEXT (the ONLY legal references you may cite):
---
${groundingContext}
---

OUTPUT FORMAT: Respond with valid JSON matching this exact structure:
{
  "emails": [
    {
      "step_number": 1,
      "name": "Formal Cancellation Demand",
      "subject": "Formal Request to Cancel Subscription — [account identifier]",
      "body": "...",
      "timing_description": "Send immediately (Day 0)",
      "cited_statute_ids": ["statute-id-1", "statute-id-2"]
    },
    {
      "step_number": 2,
      "name": "Follow-Up with Escalation Notice",
      "subject": "Second Request — No Response to Cancellation Demand — [account identifier]",
      "body": "...",
      "timing_description": "Send on Day 7 if no response",
      "cited_statute_ids": ["statute-id-1"]
    },
    {
      "step_number": 3,
      "name": "Final Notice Before Regulatory Complaint",
      "subject": "Final Notice — Cancellation Request Unresolved — [account identifier]",
      "body": "...",
      "timing_description": "Send on Day 14 if still no response",
      "cited_statute_ids": ["statute-id-1", "statute-id-3"]
    }
  ]
}

cited_statute_ids must contain ONLY statute_ids that appear in the grounding context. Do not invent IDs.
The body should use \\n for line breaks. Do not use HTML.
Return ONLY the JSON object — no markdown fences, no commentary.
${PROMPT_INJECTION_GUARD}`;
}

/* ------------------------------------------------------------------ */
/*  User message                                                      */
/* ------------------------------------------------------------------ */

function buildUserMessage(
  userSituation: UserSituation,
  vertical?: string,
): string {
  // Build the data section with sanitized user inputs (SEC-01)
  const dataLines: string[] = [];

  dataLines.push(`Company: ${sanitizeShortField(userSituation.company_name)}`);
  dataLines.push(`Service Type: ${sanitizeShortField(userSituation.service_type)}`);

  if (vertical) {
    dataLines.push(`Vertical: ${sanitizeShortField(vertical)}`);
  }

  if (userSituation.account_identifier) {
    dataLines.push(`Account/Subscription Identifier: ${sanitizeShortField(userSituation.account_identifier)}`);
  }

  if (userSituation.billing_email) {
    dataLines.push(`Billing Email on Account: ${sanitizeShortField(userSituation.billing_email)}`);
  }

  if (userSituation.monthly_charge) {
    dataLines.push(`Charge Amount: ${sanitizeShortField(userSituation.monthly_charge)}`);
  }

  if (userSituation.billing_frequency) {
    dataLines.push(`Billing Frequency: ${sanitizeShortField(userSituation.billing_frequency)}`);
  }

  if (userSituation.last_charge_date) {
    dataLines.push(`Most Recent Charge Date: ${sanitizeShortField(userSituation.last_charge_date)}`);
  }

  if (userSituation.cancellation_effective_date) {
    const effectiveLabel = userSituation.cancellation_effective_date === 'immediately'
      ? 'Immediately — stop all charges now'
      : 'End of current billing period';
    dataLines.push(`Requested Cancellation Effective Date: ${effectiveLabel}`);
  }

  if (userSituation.previous_cancellation_date) {
    dataLines.push(`Previous Cancellation Attempt Date: ${sanitizeShortField(userSituation.previous_cancellation_date)}`);
  }
  if (userSituation.previous_cancellation_method) {
    dataLines.push(`Previous Cancellation Method: ${sanitizeShortField(userSituation.previous_cancellation_method)}`);
  }
  if (userSituation.previous_cancellation_result) {
    dataLines.push(`Result of Previous Attempt: ${sanitizeShortField(userSituation.previous_cancellation_result)}`);
  }

  if (userSituation.wants_refund && userSituation.refund_amount) {
    dataLines.push(`Refund Requested: Yes — $${sanitizeShortField(userSituation.refund_amount)}`);
    if (userSituation.refund_reason) {
      dataLines.push(`Refund Reason: ${sanitizeShortField(userSituation.refund_reason)}`);
    }
  }

  if (userSituation.cancellation_barriers.length > 0) {
    dataLines.push(
      `Cancellation Barriers Experienced:\n${userSituation.cancellation_barriers.map((b) => `  - ${sanitizeLongField(b)}`).join('\n')}`,
    );
  }

  if (userSituation.additional_details) {
    dataLines.push(`Additional Details: ${sanitizeLongField(userSituation.additional_details)}`);
  }

  // Wrap user data in XML delimiters and append the generation instruction outside the tags
  const wrappedData = wrapUserData(dataLines.join('\n'));

  return `${wrappedData}\n\nGenerate a 3-step cancellation email sequence for this situation. Use ALL of the user data above to personalize each email. Use ONLY statutes from the grounding context.`;
}

/* ------------------------------------------------------------------ */
/*  Parse response                                                    */
/* ------------------------------------------------------------------ */

function parseGenerationResponse(
  raw: string,
  groundingStatuteIds: string[],
): SequenceStep[] {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned) as GenerationResponse;

  if (!parsed.emails || !Array.isArray(parsed.emails) || parsed.emails.length !== 3) {
    throw new Error(
      'Generation response must contain exactly 3 emails.',
    );
  }

  const groundingSet = new Set(groundingStatuteIds);

  return parsed.emails.map((email): SequenceStep => {
    const citations: Citation[] = email.cited_statute_ids
      .filter((id) => groundingSet.has(id))
      .map((id) => ({
        statute_id: id,
        citation_text: id,
        is_grounded: true,
      }));

    return {
      step_number: email.step_number,
      name: email.name,
      subject: email.subject,
      body: email.body,
      timing_description: email.timing_description,
      citations,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates a 3-step subscription cancellation email sequence.
 *
 * @param groundingContext  The assembled grounding context string from assembleGroundingContext().
 * @param groundingStatuteIds  Statute IDs present in the grounding context.
 * @param userSituation  Details about the user's cancellation situation.
 * @param vertical  Optional vertical (e.g. "gym", "telecom").
 * @param strict  If true, uses a stricter prompt (for retry after compliance failure).
 */
export async function generateSubscriptionSequence(
  groundingContext: string,
  groundingStatuteIds: string[],
  userSituation: UserSituation,
  vertical?: string,
  strict = false,
): Promise<SequenceStep[]> {
  const openai = getOpenAIClient();

  let systemPrompt = buildSystemPrompt(groundingContext);

  if (strict) {
    systemPrompt += `

STRICT MODE — ADDITIONAL CONSTRAINTS:
- Do NOT use ANY phrase from this list: "you should", "I recommend", "we recommend", "you are entitled", "your rights", "you have a case", "legal advice", "strong case", "weak case", "likely to win", "guaranteed", "will recover", "robot lawyer", "AI lawyer", "legal representation", "on your behalf", "your attorney", "legal counsel".
- Double-check every citation: ONLY cite statutes whose statute_id appears in the grounding context.
- If you are uncertain whether a statute is in the context, do NOT cite it.
- Keep language purely descriptive and factual.`;
  }

  const userMessage = buildUserMessage(userSituation, vertical);

  const response = await openai.chat.completions.create({
    model: AI_CONFIG.generation.model,
    max_tokens: AI_CONFIG.generation.maxTokens,
    temperature: AI_CONFIG.generation.temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI returned an empty response.');
  }

  return parseGenerationResponse(content, groundingStatuteIds);
}

// Export for testing
export { buildSystemPrompt, buildUserMessage, parseGenerationResponse };
