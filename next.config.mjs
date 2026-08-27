const isDev = process.env.NODE_ENV !== 'production';

/**
 * The browser's ConvexReactClient connects to NEXT_PUBLIC_CONVEX_URL over
 * WebSocket + HTTP, so the CSP connect-src must allow that origin (and its ws
 * form). Derive it from the env var so self-hosted (e.g. convex.resolvaio.com)
 * and local dev (127.0.0.1:3210) both work without editing the policy.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
const convexConnectSrc = (() => {
  if (!convexUrl) return '';
  try {
    const u = new URL(convexUrl);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    // Convex HTTP actions run on the next port up (site origin); allow the whole
    // host so both the API (:3210) and HTTP-actions (:3211) endpoints resolve.
    return `${u.protocol}//${u.hostname}:* ${wsProto}//${u.hostname}:*`;
  } catch {
    return convexUrl;
  }
})();
// In dev, also allow plain localhost variants for convenience.
const devConnect = isDev
  ? 'http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*'
  : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' output requires symlinks — enabled in Docker/Linux builds.
  // On Windows dev, comment this out or run as Administrator.
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  experimental: {
    // Runs instrumentation.ts at server boot — this is what initializes Sentry.
    instrumentationHook: true,
    // archiver (and its dep readdir-glob) use a malformed exports field where
    // "default" is not the last condition, breaking webpack module resolution.
    // Since archiver is server-only (used in packet bundle generation), we
    // exclude it from webpack bundling entirely.
    serverComponentsExternalPackages: ['archiver'],
    // Prevents barrel-export packages from overwhelming webpack chunking in dev.
    // lucide-react alone has 1000+ exports; without this, webpack can fail with
    // "Cannot read properties of undefined (reading 'call')".
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'date-fns-tz',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-avatar',
      '@radix-ui/react-separator',
    ],
  },
  images: {
    remotePatterns: [
      // Cloudflare R2 (public bucket / custom domain), if images are served.
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
  async headers() {
    return [
      // VULN-16: Explicit CORS for API routes — deny cross-origin by default
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: isDev ? '*' : 'https://app.resolvaio.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // SEC-12: Content-Security-Policy rationale
            //
            // 'unsafe-inline' (scripts): Required by Next.js for inline script
            //   tags injected during SSR (e.g. __NEXT_DATA__, hydration scripts).
            //   Next.js App Router does not yet support nonce-based CSP natively.
            //   Tracked: https://github.com/vercel/next.js/discussions/54907
            //
            // 'unsafe-eval' is deliberately EXCLUDED in production. It is only
            //   needed for webpack hot-reload (dev only). Polar checkout is a
            //   full redirect to its hosted page — no in-page SDK/eval.
            //
            // 'unsafe-inline' (styles): Required by Radix UI and Next.js
            //   style injection. Cannot be replaced with nonces without
            //   a full migration to a nonce-aware style system.
            //
            // External domains: Polar (checkout redirect + API), Plausible
            //   (analytics), Convex (self-hosted REST + WebSocket, on
            //   *.resolvaio.com), OpenAI (generation), Tavily (search).
            //   Polar checkout navigates the top-level document (redirect), so it
            //   needs form-action/connect-src, not frame-src.
            //
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is only included in dev (React Refresh / HMR needs it).
              // In production it is deliberately excluded (SEC-12).
              `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://plausible.io`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              `connect-src 'self' ${convexConnectSrc} ${devConnect} https://*.resolvaio.com wss://*.resolvaio.com https://api.openai.com https://api.tavily.com https://api.polar.sh https://sandbox-api.polar.sh https://plausible.io`,
              "object-src 'none'",
              "base-uri 'self'",
              // Polar checkout starts by navigating the browser to checkout.polar.sh
              // (via our /api/checkout redirect), so allow it as a form/navigation target.
              "form-action 'self' https://checkout.polar.sh https://sandbox.polar.sh",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
