import { type NextRequest, NextResponse } from 'next/server';
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';

/**
 * Middleware — replaces the Supabase session-refresh middleware.
 *
 * Uses convexAuthNextjsMiddleware to resolve the Convex Auth session, then keeps
 * the app's existing subdomain routing (resolvaio.com marketing vs
 * app.resolvaio.com app) and the public/protected route policy.
 */

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
  '/api/keep-alive',
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
  return (
    hostname === 'localhost' ||
    hostname.startsWith('127.0.0.1') ||
    hostname.startsWith('192.168.')
  );
}

const isProtected = createRouteMatcher(
  // Everything that isn't a known public route/prefix is protected. We express
  // this as "not public" inside the handler rather than a positive matcher,
  // because the public set is large and prefix-based.
  ['/((?!$).*)'],
);

export default convexAuthNextjsMiddleware(async (request: NextRequest, { convexAuth }) => {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host')?.split(':')[0] ?? '';
  const isDev = isLocalhost(hostname);

  /* ---- Subdomain routing (production only) ---- */
  if (!isDev) {
    const isAppSubdomain = hostname === APP_HOSTNAME || hostname.startsWith('app.');
    const isRootDomain = hostname === ROOT_HOSTNAME || hostname === `www.${ROOT_HOSTNAME}`;

    if (isRootDomain && isAppOnlyPath(pathname)) {
      const appUrl = request.nextUrl.clone();
      appUrl.hostname = APP_HOSTNAME;
      appUrl.port = '';
      return NextResponse.redirect(appUrl);
    }

    if (
      isAppSubdomain &&
      !isAppOnlyPath(pathname) &&
      isPublicPath(pathname) &&
      pathname !== '/login' &&
      pathname !== '/register' &&
      pathname !== '/auth/callback' &&
      pathname !== '/auth/confirm' &&
      pathname !== '/forgot-password' &&
      pathname !== '/update-password' &&
      !pathname.startsWith('/api/')
    ) {
      const rootUrl = request.nextUrl.clone();
      rootUrl.hostname = ROOT_HOSTNAME;
      rootUrl.port = '';
      return NextResponse.redirect(rootUrl);
    }
  }

  /* ---- Public API endpoints bypass auth ---- */
  if (isPublicPath(pathname) && pathname.startsWith('/api/')) {
    return;
  }

  const authed = await convexAuth.isAuthenticated();

  /* ---- Redirect unauthenticated users away from protected routes ---- */
  if (!authed && isProtected(request) && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    // VULN-12: only set `next` for a safe relative path (no open redirect)
    if (pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('://')) {
      loginUrl.searchParams.set('next', pathname);
    }
    return nextjsMiddlewareRedirect(request, loginUrl.pathname + loginUrl.search);
  }

  /* ---- Authenticated user on root domain hitting app page → app subdomain ---- */
  if (authed && !isDev && !isPublicPath(pathname)) {
    const isRootDomain = hostname === ROOT_HOSTNAME || hostname === `www.${ROOT_HOSTNAME}`;
    if (isRootDomain) {
      const appUrl = request.nextUrl.clone();
      appUrl.hostname = APP_HOSTNAME;
      appUrl.port = '';
      return NextResponse.redirect(appUrl);
    }
  }

  /* ---- Belt-and-braces noindex on the private app surface ---- */
  // These paths are also left out of the sitemap and disallowed in robots.txt.
  // The X-Robots-Tag header is the layer crawlers honour even without rendering
  // HTML — so a private page can never leak into the index (three layers total).
  if (isAppOnlyPath(pathname)) {
    const res = NextResponse.next({ request });
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  return;
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
