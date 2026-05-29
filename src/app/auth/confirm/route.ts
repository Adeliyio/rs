import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * GET /auth/confirm
 *
 * Handles email confirmation links. Verifies the OTP token from the
 * confirmation email and, on success, redirects to the main app.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL('/new', origin));
    }
  }

  // Verification failed — send the user back to login
  return NextResponse.redirect(
    new URL('/login?error=confirmation_failed', request.nextUrl.origin),
  );
}
