import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Routes that do not require an authenticated session. */
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/pricing',
  '/login',
  '/register',
  '/auth/callback',
  '/auth/confirm',
  '/forgot-password',
  '/update-password',
];

/** Path prefixes for public marketing/SEO pages (SEC-25). */
const PUBLIC_PREFIXES = [
  '/deposit',
  '/subscription',
  '/cancel',
  '/tools',
  '/blog',
  '/api/webhooks/',
  '/api/trust/',
  '/api/waitlist',
];

/** Pages that should only be served on the app subdomain. */
const APP_ONLY_PREFIXES = [
  '/case',
  '/new',
  '/settings',
  '/admin',
  '/api/cases',
  '/api/admin',
  '/api/account',
  '/api/diagnostic',
  '/api/documents',
  '/api/sequences',
];

/**
 * The root domain (resolvaio.com) serves marketing pages.
 * The app subdomain (app.resolvaio.com) serves the authenticated app.
 *
 * In development (localhost), all routes are served from the same host.
 */
const APP_HOSTNAME = process.env.APP_HOSTNAME ?? 'app.resolvaio.com';
const ROOT_HOSTNAME = process.env.ROOT_HOSTNAME ?? 'resolvaio.com';

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === '/api/health'
  );
}

function isAppOnlyPath(pathname: string): boolean {
  return APP_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname.startsWith('127.0.0.1') || hostname.startsWith('192.168.');
}

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes.
 *
 * Subdomain routing:
 * - resolvaio.com → marketing pages, login, register
 * - app.resolvaio.com → authenticated case management
 * - localhost → both (development mode, no subdomain enforcement)
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host')?.split(':')[0] ?? '';

  // Skip subdomain enforcement in development
  const isDev = isLocalhost(hostname);

  // Subdomain routing (production only)
  if (!isDev) {
    const isAppSubdomain = hostname === APP_HOSTNAME || hostname.startsWith('app.');
    const isRootDomain = hostname === ROOT_HOSTNAME || hostname === `www.${ROOT_HOSTNAME}`;

    // Root domain requesting an app-only page → redirect to app subdomain
    if (isRootDomain && isAppOnlyPath(pathname)) {
      const appUrl = request.nextUrl.clone();
      appUrl.hostname = APP_HOSTNAME;
      appUrl.port = '';
      return NextResponse.redirect(appUrl);
    }

    // App subdomain requesting a marketing page → redirect to root domain
    if (isAppSubdomain && !isAppOnlyPath(pathname) && isPublicPath(pathname) && pathname !== '/login' && pathname !== '/register' && pathname !== '/auth/callback' && pathname !== '/auth/confirm' && pathname !== '/forgot-password' && pathname !== '/update-password' && !pathname.startsWith('/api/')) {
      const rootUrl = request.nextUrl.clone();
      rootUrl.hostname = ROOT_HOSTNAME;
      rootUrl.port = '';
      return NextResponse.redirect(rootUrl);
    }
  }

  // Allow webhook, health, and public API endpoints without auth
  if (isPublicPath(pathname) && pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Supabase credentials are required — block all protected routes
    if (!isPublicPath(pathname)) {
      const errorUrl = request.nextUrl.clone();
      errorUrl.pathname = '/login';
      errorUrl.searchParams.set('error', 'configuration_error');
      return NextResponse.redirect(errorUrl);
    }
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  // eslint-disable-next-line @typescript-eslint/no-deprecated -- We use getAll/setAll; the deprecation warning is for the old get/set/remove API
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          const cookieOptions = options ?? {};
          supabaseResponse.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });

  // IMPORTANT: Do not write any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on root domain hitting a non-public page → send to app subdomain
  if (user && !isDev && !isPublicPath(pathname)) {
    const hostHeader = hostname;
    const isRootDomain = hostHeader === ROOT_HOSTNAME || hostHeader === `www.${ROOT_HOSTNAME}`;
    if (isRootDomain) {
      const appUrl = request.nextUrl.clone();
      appUrl.hostname = APP_HOSTNAME;
      appUrl.port = '';
      return NextResponse.redirect(appUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Common static file extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
