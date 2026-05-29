import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * GET /auth/callback
 *
 * Handles the OAuth redirect from providers (e.g. Google) and email-based
 * auth flows. Exchanges the authorization `code` for a session, then
 * redirects to the main app.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this is a password reset flow
      const type = searchParams.get('type');
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/update-password', origin));
      }

      return NextResponse.redirect(new URL('/new', origin));
    }
  }

  // Something went wrong — redirect back to login with an error hint
  return NextResponse.redirect(
    new URL('/login?error=auth_failed', request.nextUrl.origin),
  );
}
