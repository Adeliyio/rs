import { type NextRequest, NextResponse } from 'next/server';

/**
 * Middleware — resolves the Better Auth session (edge-safe).
 *
 * Checks for the Better Auth session COOKIE without a network round-trip (the
 * documented optimistic middleware pattern — the real session is still verified
 * server-side on every Convex call). We read the cookie inline rather than
 * importing `getSessionCookie` from `better-auth/cookies`: that module's barrel
 * transitively pulls in `getCookieCache` → jose JWE decrypt → `DecompressionStream`,
 * a Node API the Edge Runtime (where middleware runs) does not support, which
 * broke the production build. `getSessionCookie` itself is pure cookie parsing,
 * so the inline equivalent below is behaviourally identical and edge-safe.
 */

// Better Auth default cookie identity: prefix `better-auth`, name
// `session_token` → `better-auth.session_token`. getSessionCookie also accepts a
// `-` separated variant and the `__Secure-` prefix (production HTTPS), so we
// check all four the same way it does. Presence only — never decrypted here.
const SESSION_COOKIE_NAMES = [
  '__Secure-better-auth.session_token',
  'better-auth.session_token',
  '__Secure-better-auth-session_token',
  'better-auth-session_token',
] as const;

/** Edge-safe presence check for the Better Auth session cookie. */
function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
}

/** Routes that do not require an authenticated session. */
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/how-accurate',
  '/pricing',
  '/login',
  '/register',
  '/forgot-password',
  '/update-password',
  // Value-first funnel entry (SPEC.md M3): the anonymous diagnostic runs here
  // with no account. It only reads the public /api/diagnostic/{graph,preview,
  // cancellation} endpoints (already public above) — nothing that costs money —
  // so the page itself must be public too.
  '/start',
];

/** Path prefixes for public marketing/SEO pages (SEC-25). */
const PUBLIC_PREFIXES = [
  '/deposit',
  '/subscription',
  '/cancel',
  '/tools',
  '/blog',
  // Legal pages (terms, privacy, cookies, acceptable-use, ai-disclosure,
  // accessibility) are linked from every marketing footer and listed in the
  // sitemap — they must be crawlable, not redirected to /login.
  '/legal',
  // Better Auth's own endpoints (sign-in, sign-up, OTP verify, OAuth callback,
  // token, sign-out) live under /api/auth and MUST be reachable without a
  // session — otherwise the unauthenticated login/signup POST itself would be
  // redirected to /login, breaking auth entirely.
  '/api/auth',
  '/api/webhooks/',
  '/api/trust/',
  '/api/waitlist',
  '/api/keep-alive',
  // The free generic demand-letter template served to unsupported-jurisdiction
  // visitors — a static, non-personalized KB document, shown alongside the
  // (already-public) waitlist form, so it must be reachable with no account.
  '/api/kb/',
  // Value-first funnel (M3): the anonymous diagnostic preview is a deterministic,
  // no-cost, no-write KB read — public so a visitor sees their result before any
  // account. Note this is more specific than the app-only '/api/diagnostic'
  // prefix, and public API paths are matched first in the middleware, so only
  // '/api/diagnostic/preview' is exposed — '/api/diagnostic/state' stays gated.
  '/api/diagnostic/preview',
  // The diagnostic question graph is a static KB file (no per-user data) — public
  // so the anonymous flow can render questions before any account exists.
  '/api/diagnostic/graph',
  // Anonymous cancellation generation — the free wedge is fully open. Generation
  // is deterministic templates ($0, no AI), returns the sequence without any DB
  // write, so it is safe and cost-free to expose anonymously.
  '/api/diagnostic/cancellation',
];

/**
 * Public metadata / well-known files that MUST be crawlable and never gated
 * behind auth. These are Next.js metadata routes (app/sitemap.ts, robots.ts,
 * llms.txt, manifest, OG/social images) — redirecting them to /login makes the
 * site invisible to search engines and breaks social previews.
 */
const PUBLIC_METADATA_FILES = [
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt',
  '/manifest.json',
  '/manifest.webmanifest',
  '/opengraph-image',
  '/twitter-image',
  '/apple-icon',
  '/icon.svg',
];

/** Pages that should only be served on the app subdomain. */
const APP_ONLY_PREFIXES = [
  '/case',
  '/new',
  '/settings',
  '/admin',
  // Post-checkout confirmation — app-only and must carry the noindex header
  // (previously it relied solely on the auth redirect, leaving it outside the
  // declared noindex layers).
  '/success',
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
    PUBLIC_METADATA_FILES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === '/api/health'
  );
}

function isAppOnlyPath(pathname: string): boolean {
  // A path that is explicitly public is never "app-only" — otherwise the
  // subdomain router would redirect it to app.resolvaio.com. That matters for
  // the anonymous diagnostic endpoints (/api/diagnostic/{graph,preview,
  // cancellation}): they are called by the public /start page on the ROOT
  // domain, and a cross-subdomain redirect turns them into a CORS failure.
  if (isPublicPath(pathname)) return false;
  return APP_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.startsWith('127.0.0.1') ||
    hostname.startsWith('192.168.')
  );
}

// Everything that isn't a known public route/prefix is protected. We express
// this as "not public" inside the handler; this matcher only excludes the exact
// root path '/' (which is public anyway), matching the former createRouteMatcher.
function isProtected(request: NextRequest): boolean {
  return request.nextUrl.pathname !== '/';
}

export default async function middleware(request: NextRequest): Promise<NextResponse | undefined> {
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

  // Optimistic session check: presence of the Better Auth session cookie. This
  // is a cheap edge-safe gate for routing only — every Convex call still fully
  // verifies the session server-side, so a stale/forged cookie grants no data.
  const authed = hasSessionCookie(request);

  /* ---- Redirect unauthenticated users away from protected routes ---- */
  if (!authed && isProtected(request) && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    // VULN-12: only set `next` for a safe relative path (no open redirect)
    if (pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.includes('://')) {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
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
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
