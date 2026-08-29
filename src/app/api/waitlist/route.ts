/**
 * POST /api/waitlist
 *
 * Captures a waitlist entry for users in unsupported jurisdictions.
 * Validates { email, state, wedge }, rate-limits by IP, and inserts
 * into the waitlist_entries table. Duplicate (email, state, wedge)
 * tuples are handled gracefully — the unique constraint returns a
 * conflict rather than an error.
 *
 * Rate limit: 5 requests per hour per IP address.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';

import { createServiceConvexClient, serviceSecret } from '@/lib/convex/service';
import { api } from '@convex/api';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { WEDGE, type Wedge } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Validation schema                                                 */
/* ------------------------------------------------------------------ */

const waitlistSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email('Invalid email address'),
  state: z
    .string()
    .min(2, 'State code required')
    .max(2, 'Use 2-letter state code')
    .toUpperCase(),
  wedge: z.enum(WEDGE as unknown as [Wedge, ...Wedge[]]),
});

/* ------------------------------------------------------------------ */
/*  POST handler                                                      */
/* ------------------------------------------------------------------ */

// This route calls Convex at request time; force-dynamic so Next does not
// evaluate it during build-time page-data collection (fails without runtime env).
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    /* ---- Rate limit by IP ---- */
    const headersList = headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      'unknown';

    const rateResult = await checkRateLimit('auth', `waitlist:${ip}`);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(rateResult) },
      );
    }

    /* ---- Parse and validate body ---- */
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const parsed = waitlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { name, email, state, wedge } = parsed.data;

    /* ---- Insert into waitlist (service; dedup handled in the mutation) ---- */
    const convex = createServiceConvexClient();
    const result = await convex.mutation(api.service.joinWaitlist, {
      secret: serviceSecret(),
      email,
      name,
      state,
      wedge,
    });

    if (result.duplicate) {
      return NextResponse.json({
        ok: true,
        message: 'You are already on the waitlist for this state.',
      });
    }

    return NextResponse.json({
      ok: true,
      message: `You have been added to the waitlist for ${state} ${wedge} coverage.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/waitlist error:', message);
    // eslint-disable-next-line no-console
    console.error('[api]', message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
