import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /auth/confirm
 *
 * Under Supabase this verified an email-confirmation link (token_hash). With
 * Convex Auth, email verification is an OTP-code flow completed on the register
 * page (enter the 8-digit code). This route is retained only so any old
 * confirmation links resolve gracefully — it sends the user to login.
 */
export function GET(request: NextRequest): NextResponse {
  return NextResponse.redirect(
    new URL('/login?message=Please sign in to continue.', request.nextUrl.origin),
  );
}
