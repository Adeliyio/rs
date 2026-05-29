/**
 * Deposit demand letter generation — server-only.
 *
 * Calls GPT-4o to generate a security deposit demand letter
 * grounded in the assembled KB context. The system prompt enforces
 * compliance constraints: third-person collective framing, grounded
 * citations only, no evaluative language.
 */

import { getOpenAIClient } from '@/lib/ai/openai-client';
import { AI_CONFIG } from '@/config/ai.config';
import {
  sanitizeShortField,
  sanitizeLongField,
  wrapUserData,
  PROMPT_INJECTION_GUARD,
} from '@/lib/ai/prompt-sanitizer';
import type { Citation } from '@/types/generation.types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TenantSituation {
  tenant_name: string;
  property_address: string;
  landlord_name: string;
  landlord_address?: string;
  move_out_date: string;
  lease_start_date?: string;
  lease_end_date?: string;
  original_deposit_amount: number;
  amount_returned?: number;
  amount_withheld: number;
  demand_amount: number;
  deductions: Deduction[];
  days_since_move_out: number;
  itemization_received: boolean;
  itemization_status: ItemizationStatus;
  forwarding_address_provided: boolean;
  forwarding_address_date?: string;
  walkthrough_completed?: boolean;
  additional_context?: string;
}

export interface Deduction {
  description: string;
  amount: number;
  disputed: boolean;
  basis_for_dispute?: string;
}

export type ItemizationStatus =
  | 'nothing'
  | 'partial_return_no_itemization'
  | 'partial_return_with_itemization'
  | 'letter_only';

interface GeneratedLetterResponse {
  letter_content: string;
  rebuttal_table?: string;
  cited_statute_ids: string[];
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                     */
/* ------------------------------------------------------------------ */

function buildDepositSystemPrompt(groundingContext: string): string {
  return `You are a writing assistant that drafts security deposit demand letters on behalf of tenants. You generate professional, factual letters grounded in verified state-specific landlord-tenant law.

CRITICAL RULES — you must follow ALL of these:

1. THIRD-PERSON COLLECTIVE: Use collective framing throughout. Examples:
   - "Tenants in [State] in similar circumstances typically cite..."
   - "Under [State] law, landlords are generally required to..."
   - "The typical remedy available in these circumstances includes..."
   EXCEPT: The letter opening ("I am writing regarding...") and closing ("Sincerely") are in first person, because this is a letter FROM the tenant.

2. GROUNDED CITATIONS ONLY: You may ONLY reference statutes, rules, and legal provisions that appear in the GROUNDING CONTEXT below. Do NOT fabricate, invent, or hallucinate any legal citation. Use the exact citation text from the grounding context.

3. NO EVALUATIVE LANGUAGE: Never use phrases that evaluate the tenant's case or predict outcomes. Prohibited examples: "strong case", "you are entitled", "your rights", "you have a case", "legal advice", "likely to win", "guaranteed", "will recover". Instead, describe what the law provides and what the tenant is requesting.

4. NO THREATS: Do not threaten lawsuits or use aggressive language. Reference legitimate escalation paths (small claims court, state attorney general complaint) factually and without ultimatums.

5. LETTER SECTIONS (in order):
   a. Sender block (tenant name, address)
   b. Date
   c. Recipient block (landlord name, address)
   d. RE line (property address, lease period, deposit amount)
   e. Opening paragraph (factual statement of tenancy and deposit)
   f. Factual background (move-out date, days elapsed, statutory deadline)
   g. Itemization status section (conditional based on what tenant received)
   h. Itemized disputes section (if deductions received — include rebuttal table)
   i. Demand paragraph (specific dollar amount, deadline for response)
   j. Escalation notice (statutory penalties, small claims court — factual, not threatening)
   k. Closing and signature block

6. REQUIRED ELEMENTS:
   - Property address
   - Lease dates (if provided)
   - Security deposit amount
   - Move-out date
   - At least one statute citation from the grounding context
   - Specific demand amount
   - Response deadline (15 days from receipt)

7. REBUTTAL TABLE: If the tenant has disputed deductions, generate a Markdown table with columns:
   | Landlord's Deduction | Amount Claimed | Status | Basis for Dispute |
   Use statutory reasoning from the grounding context for each dispute basis.

8. TONE: Professional, firm, factual. Not emotional, threatening, or pleading.

9. PLACEHOLDERS: Use [YOUR NAME] style placeholders ONLY for information not provided in the tenant situation. Pre-fill everything from the provided data.

GROUNDING CONTEXT (the ONLY legal references you may cite):
---
${groundingContext}
---

OUTPUT FORMAT: Respond with valid JSON matching this exact structure:
{
  "letter_content": "Full letter text with \\n for line breaks",
  "rebuttal_table": "Markdown table if disputes exist, null otherwise",
  "cited_statute_ids": ["statute-id-1", "statute-id-2"]
}

Return ONLY the JSON object — no markdown fences, no commentary.
${PROMPT_INJECTION_GUARD}`;
}

/* ------------------------------------------------------------------ */
/*  User message                                                      */
/* ------------------------------------------------------------------ */

function buildDepositUserMessage(situation: TenantSituation): string {
  // Build the data section with sanitized user inputs (SEC-01)
  const dataLines: string[] = [];

  dataLines.push(`Tenant Name: ${sanitizeShortField(situation.tenant_name)}`);
  dataLines.push(`Property Address: ${sanitizeShortField(situation.property_address)}`);
  dataLines.push(`Landlord Name: ${sanitizeShortField(situation.landlord_name)}`);
  if (situation.landlord_address) {
    dataLines.push(`Landlord Address: ${sanitizeShortField(situation.landlord_address)}`);
  }
  dataLines.push(`Move-Out Date: ${sanitizeShortField(situation.move_out_date)}`);
  if (situation.lease_start_date) {
    dataLines.push(`Lease Start: ${sanitizeShortField(situation.lease_start_date)}`);
  }
  if (situation.lease_end_date) {
    dataLines.push(`Lease End: ${sanitizeShortField(situation.lease_end_date)}`);
  }
  dataLines.push(`Original Deposit: $${situation.original_deposit_amount}`);
  if (situation.amount_returned !== undefined) {
    dataLines.push(`Amount Returned: $${situation.amount_returned}`);
  }
  dataLines.push(`Amount Withheld: $${situation.amount_withheld}`);
  dataLines.push(`Amount Demanded: $${situation.demand_amount}`);
  dataLines.push(`Days Since Move-Out: ${situation.days_since_move_out}`);
  dataLines.push(`Itemization Status: ${sanitizeShortField(situation.itemization_status)}`);
  dataLines.push(
    `Forwarding Address Provided: ${situation.forwarding_address_provided ? 'Yes' : 'No'}`,
  );
  if (situation.forwarding_address_date) {
    dataLines.push(
      `Forwarding Address Date: ${sanitizeShortField(situation.forwarding_address_date)}`,
    );
  }
  if (situation.walkthrough_completed !== undefined) {
    dataLines.push(
      `Move-Out Walkthrough Offered: ${situation.walkthrough_completed ? 'Yes' : 'No'}`,
    );
  }

  if (situation.deductions.length > 0) {
    dataLines.push('\nDeductions Claimed by Landlord:');
    for (const d of situation.deductions) {
      const status = d.disputed ? 'DISPUTED' : 'Accepted';
      dataLines.push(`  - ${sanitizeLongField(d.description)}: $${d.amount} [${status}]`);
      if (d.disputed && d.basis_for_dispute) {
        dataLines.push(`    Dispute basis: ${sanitizeLongField(d.basis_for_dispute)}`);
      }
    }
  }

  if (situation.additional_context) {
    dataLines.push(`\nAdditional Context: ${sanitizeLongField(situation.additional_context)}`);
  }

  // Wrap user data in XML delimiters and append the generation instruction outside the tags
  const wrappedData = wrapUserData(dataLines.join('\n'));

  return `${wrappedData}\n\nGenerate a security deposit demand letter for this situation. Use ONLY statutes from the grounding context. Use third-person collective framing for legal reasoning.`;
}

/* ------------------------------------------------------------------ */
/*  Parse response                                                    */
/* ------------------------------------------------------------------ */

function parseDepositResponse(
  raw: string,
  groundingStatuteIds: string[],
): {
  content: string;
  rebuttal_table: string | undefined;
  citations: Citation[];
} {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned) as GeneratedLetterResponse;

  if (!parsed.letter_content || typeof parsed.letter_content !== 'string') {
    throw new Error('Generation response must contain letter_content string.');
  }

  const groundingSet = new Set(groundingStatuteIds);

  const citations: Citation[] = (parsed.cited_statute_ids ?? [])
    .filter((id: string) => groundingSet.has(id))
    .map((id: string) => ({
      statute_id: id,
      citation_text: id,
      is_grounded: true,
    }));

  return {
    content: parsed.letter_content,
    rebuttal_table: parsed.rebuttal_table ?? undefined,
    citations,
  };
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generates a security deposit demand letter.
 *
 * @param groundingContext  The assembled grounding context string.
 * @param groundingStatuteIds  Statute IDs present in the grounding context.
 * @param tenantSituation  Details about the tenant's deposit situation.
 * @param strict  If true, uses a stricter prompt (for retry after compliance failure).
 */
export async function generateDepositLetter(
  groundingContext: string,
  groundingStatuteIds: string[],
  tenantSituation: TenantSituation,
  strict = false,
): Promise<{
  content: string;
  rebuttal_table: string | undefined;
  citations: Citation[];
}> {
  const openai = getOpenAIClient();

  let systemPrompt = buildDepositSystemPrompt(groundingContext);

  if (strict) {
    systemPrompt += `

STRICT MODE — ADDITIONAL CONSTRAINTS:
- Do NOT use ANY phrase from this list: "you should", "I recommend", "we recommend", "you are entitled", "your rights", "you have a case", "legal advice", "strong case", "weak case", "likely to win", "guaranteed", "will recover", "robot lawyer", "AI lawyer", "legal representation", "on your behalf", "your attorney", "legal counsel", "demand your deposit back", "your landlord violated", "your landlord is liable".
- Double-check every citation: ONLY cite statutes whose statute_id appears in the grounding context.
- If you are uncertain whether a statute is in the context, do NOT cite it.
- Keep language purely descriptive and factual. Use third-person collective framing for ALL legal reasoning.`;
  }

  const userMessage = buildDepositUserMessage(tenantSituation);

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

  return parseDepositResponse(content, groundingStatuteIds);
}

// Export for testing
export { buildDepositSystemPrompt, buildDepositUserMessage, parseDepositResponse };
