import { NextResponse, type NextRequest } from 'next/server';

/**
 * GET /auth/callback
 *
 * Under Supabase this exchanged an OAuth/recovery `code` for a session. With
 * Convex Auth, the OAuth (Google) callback is handled by Convex Auth's own HTTP
 * routes on the Convex deployment (CONVEX_SITE_URL/api/auth/callback/google),
 * and password reset is an OTP flow on /forgot-password.
 *
 * This route is kept only so old links resolve: it sends the user to the app if
 * they already have a session, or to login otherwise. The middleware performs
 * the actual auth gating.
 */
export function GET(request: NextRequest): NextResponse {
  const { searchParams, origin } = request.nextUrl;
  if (searchParams.get('type') === 'recovery') {
    return NextResponse.redirect(new URL('/forgot-password', origin));
  }
  return NextResponse.redirect(new URL('/new', origin));
}
