/**
 * POST /api/diagnostic/preview
 *
 * PUBLIC, anonymous diagnostic preview — the value-first funnel's conversion
 * driver (SPEC.md M3). Given a wedge + jurisdiction (+ optional deposit amount),
 * returns the deterministic KB result — applicable statutes, deadline rules, and
 * whether penalties may apply — WITHOUT requiring an account, a case, or payment.
 *
 * This mirrors the authenticated GET /api/cases/[id]/preview compute, but takes
 * the inputs directly from the anonymous client (which holds the diagnostic
 * answers in memory) instead of loading a persisted case. It performs NO AI call
 * and NO write — it is purely a read of the verified knowledge base, so it is
 * free to run and safe to expose anonymously.
 *
 * Legal-safety: this returns legal INFORMATION (what the law says, deadline
 * arithmetic from the rules) — never advice. The client renders it with the
 * standard "legal information, not legal advice, not a law firm" disclaimer.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';

import { loadKbEntry } from '@/lib/kb/loader';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { WEDGE, type Wedge } from '@/types/enums';

// No auth, no Convex — but keep dynamic so it is never statically cached.
export const dynamic = 'force-dynamic';

/* ------------------------------------------------------------------ */
/*  Validation                                                        */
/* ------------------------------------------------------------------ */

const previewSchema = z.object({
  wedge: z.enum(WEDGE as unknown as [Wedge, ...Wedge[]]),
  jurisdiction: z
    .string()
    .min(2, 'Jurisdiction required')
    .max(20)
    .transform((s) => s.toUpperCase()),
  // Optional, for a richer reveal on deposit cases. Never trusted for money math
  // here — it is only echoed back for display.
  deposit_amount: z.number().nonnegative().optional(),
});

const JURISDICTION_NAMES: Record<string, string> = {
  CA: 'California',
  TX: 'Texas',
  NY: 'New York',
  FL: 'Florida',
  FEDERAL: 'Federal',
};

/* ------------------------------------------------------------------ */
/*  Handler                                                           */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<NextResponse> {
  try {
    /* ---- Rate limit by IP (cheap deterministic read; general bucket) ---- */
    const headersList = headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      'unknown';

    const rateResult = await checkRateLimit('general', `diagnostic-preview:${ip}`);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
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

    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { wedge, jurisdiction, deposit_amount } = parsed.data;

    /* ---- Load the verified KB entry (deterministic, no AI, no write) ---- */
    let kbEntry;
    try {
      kbEntry = loadKbEntry(wedge, jurisdiction);
    } catch {
      // Unsupported jurisdiction — tell the client so it can offer the waitlist.
      return NextResponse.json(
        {
          supported: false,
          jurisdiction,
          jurisdiction_full_name: JURISDICTION_NAMES[jurisdiction] ?? jurisdiction,
        },
        { status: 200 },
      );
    }

    const statutes = kbEntry.statutes ?? [];
    const deadlines = kbEntry.deadline_rules ?? [];
    const penalties = kbEntry.penalties ?? [];
    const sampleStatute = statutes[0];

    return NextResponse.json(
      {
        supported: true,
        wedge,
        jurisdiction,
        jurisdiction_full_name: JURISDICTION_NAMES[jurisdiction] ?? jurisdiction,
        deposit_amount: deposit_amount ?? null,
        statute_count: statutes.length,
        deadline_count: deadlines.length,
        penalty_available: penalties.length > 0,
        sample_statute: sampleStatute
          ? { citation: sampleStatute.citation, title: sampleStatute.title }
          : null,
      },
      { headers: rateLimitHeaders(rateResult) },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/diagnostic/preview error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
