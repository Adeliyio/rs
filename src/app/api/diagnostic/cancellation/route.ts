/**
 * POST /api/diagnostic/cancellation
 *
 * PUBLIC, anonymous subscription-cancellation generation (SPEC.md M3). The free
 * cancellation wedge is fully open — no account, no email, no payment. Since
 * generation is now deterministic templates ($0, no AI — see M2), it is safe to
 * expose anonymously. This returns the generated 3-step sequence directly in the
 * response and writes NOTHING to the database (there is no case and no user).
 *
 * The `[YOUR NAME]` / `[YOUR EMAIL]` placeholders are intentionally preserved for
 * the visitor to complete when they send the emails; `[DATE]` is filled with
 * today's date. Rate-limited by IP as belt-and-suspenders.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';

import { generateSequence } from '@/features/subscription/generation/sequence-generator';
import type { DiagnosticAnswers } from '@/features/subscription/generation/sequence-generator';
import { checkRateLimit, rateLimitHeaders, clientIp } from '@/lib/rate-limit';
import { VERTICAL, type Vertical } from '@/types/enums';

export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

// Answers are visitor-supplied free text; the template engine only inlines them
// into compliance-clean copy and the downstream compliance scan still guards the
// output, so we validate shape/length rather than content.
const answersSchema = z.object({
  jurisdiction: z.string().min(2).max(20).transform((s) => s.toUpperCase()),
  vertical: z
    .enum(VERTICAL as unknown as [Vertical, ...Vertical[]])
    .optional(),
  company_name: z.string().max(200).optional(),
  service_type: z.string().max(200).optional(),
  account_identifier: z.string().max(200).optional(),
  billing_email: z.string().max(200).optional(),
  monthly_charge: z.string().max(50).optional(),
  billing_frequency: z.string().max(50).optional(),
  last_charge_date: z.string().max(50).optional(),
  cancellation_effective_date: z.string().max(50).optional(),
  prior_cancellation_attempt: z.boolean().optional(),
  cancellation_date: z.string().max(50).optional(),
  cancellation_method: z.string().max(200).optional(),
  cancellation_result: z.string().max(500).optional(),
  wants_refund: z.boolean().optional(),
  refund_amount: z.string().max(50).optional(),
  refund_reason: z.string().max(500).optional(),
  cancellation_barriers: z.array(z.string().max(200)).max(20).optional(),
  additional_details: z.string().max(2000).optional(),
});

function fillDatePlaceholder(text: string, today: string): string {
  return text
    .replace(/\[DATE\]/gi, today)
    .replace(/\[TODAY'S DATE\]/gi, today)
    .replace(/\[TODAYS DATE\]/gi, today)
    .replace(/\[CURRENT DATE\]/gi, today);
}

/* ------------------------------------------------------------------ */
/*  Handler                                                           */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<NextResponse> {
  try {
    /* ---- Rate limit by IP (spoof-resistant key) ---- */
    const ip = clientIp(headers());

    // Free, $0, deterministic templates — use the free-template bucket (40/hr),
    // NOT the paid-AI 'generation' bucket (5/hr) that 429'd shared-IP users.
    const rateResult = await checkRateLimit('freeTemplate', `anon-cancellation:${ip}`);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    /* ---- Parse + validate ---- */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = answersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const answers: DiagnosticAnswers = {
      wedge: 'subscription',
      ...parsed.data,
    };

    /* ---- Generate (deterministic templates, $0, no persistence) ---- */
    // 'anonymous' is a synthetic case id used only to stamp the returned
    // sequence; nothing is written to the database.
    const result = await generateSequence('anonymous', answers);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: 500 },
      );
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    // The template engine returns citations as Citation objects
    // ({ statute_id, citation_text, ... }), but the anonymous wire contract
    // (parseCancellationResponse) and the result UI both expect display
    // strings. Flatten to citation_text at the boundary so the client's Zod
    // parse and `citations.join(...)` both work.
    const steps = result.sequence.steps.map((step) => ({
      ...step,
      subject: fillDatePlaceholder(step.subject, today),
      body: fillDatePlaceholder(step.body, today),
      citations: step.citations.map((c) => c.citation_text),
    }));

    return NextResponse.json(
      {
        vertical: result.sequence.vertical,
        jurisdiction: result.sequence.jurisdiction,
        steps,
      },
      { headers: rateLimitHeaders(rateResult) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/diagnostic/cancellation error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
