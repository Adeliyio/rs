const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' output requires symlinks — enabled in Docker/Linux builds.
  // On Windows dev, comment this out or run as Administrator.
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  experimental: {
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
      {
        protocol: 'https',
        hostname: '*.supabase.co',
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
            // 'unsafe-eval' is deliberately EXCLUDED in production. It was only
            //   needed for Paddle.js v1 (now removed) and webpack hot-reload (dev only).
            //   Paddle.js v2 (CDN script) works without eval.
            //
            // 'unsafe-inline' (styles): Required by Radix UI and Next.js
            //   style injection. Cannot be replaced with nonces without
            //   a full migration to a nonce-aware style system.
            //
            // External domains: Paddle CDN (payment overlay), Plausible (analytics),
            //   Supabase (REST + realtime), OpenAI (generation), Tavily (search).
            //
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is only included in dev (React Refresh / HMR needs it).
              // In production it is deliberately excluded (SEC-12).
              `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://cdn.paddle.com https://plausible.io`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.resolvaio.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.tavily.com https://api.paddle.com https://sandbox-api.paddle.com",
              "frame-src https://cdn.paddle.com https://sandbox-buy.paddle.com https://buy.paddle.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
