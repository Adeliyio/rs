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

import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { WEDGE, type Wedge } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Validation schema                                                 */
/* ------------------------------------------------------------------ */

const waitlistSchema = z.object({
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

    const { email, state, wedge } = parsed.data;

    /* ---- Insert into waitlist_entries ---- */
    const supabase = await createClient();

    const insertPayload: Record<string, unknown> = {
      email,
      state,
      wedge,
    };

    const { error: insertError } = await supabase
      .from('waitlist_entries')
      // @ts-expect-error — Supabase SSR generic doesn't resolve table Insert type from manual Database definition
      .insert(insertPayload);

    if (insertError) {
      // Handle unique constraint violation (duplicate entry)
      if (
        insertError.code === '23505' ||
        insertError.message?.includes('duplicate') ||
        insertError.message?.includes('unique')
      ) {
        // Already on waitlist — still return success
        return NextResponse.json({
          ok: true,
          message: 'You are already on the waitlist for this state.',
        });
      }

      return NextResponse.json(
        { error: 'Failed to join waitlist. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: `You have been added to the waitlist for ${state} ${wedge} coverage.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    // eslint-disable-next-line no-console
    console.error('POST /api/waitlist error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
