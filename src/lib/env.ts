import { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  Server environment schema                                         */
/* ------------------------------------------------------------------ */

const serverEnvSchema = z.object({
  // Core — Convex. REQUIRED — app will not boot without these.
  NEXT_PUBLIC_CONVEX_URL: z.string().min(1, 'NEXT_PUBLIC_CONVEX_URL is required'),
  // Convex Auth "site" URL (HTTP actions origin, port 3211 self-hosted).
  CONVEX_SITE_URL: z.string().min(1, 'CONVEX_SITE_URL is required'),
  // Shared secret for trusted server→Convex service functions (replaces the
  // Supabase service-role key). Never exposed to the browser.
  CONVEX_SERVICE_SECRET: z.string().min(1, 'CONVEX_SERVICE_SECRET is required'),
  APP_URL: z.string().min(1).default('http://localhost:3000'),

  // AI — required for generation
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Feature-specific — required when feature is used
  TAVILY_API_KEY: z.string().optional().default(''),
  // Polar payments (replaced Paddle). Optional so the app boots without payments
  // configured (e.g. the free cancellation wedge needs none); the checkout/refund
  // code throws a clear error if invoked without them.
  POLAR_ACCESS_TOKEN: z.string().optional().default(''),
  POLAR_WEBHOOK_SECRET: z.string().optional().default(''),
  POLAR_SERVER: z.enum(['sandbox', 'production']).optional().default('sandbox'),
  POLAR_SUCCESS_URL: z.string().optional().default(''),
  POLAR_PRODUCT_LETTER: z.string().optional().default(''),
  POLAR_PRODUCT_MONTHLY: z.string().optional().default(''),
  POLAR_PRODUCT_YEARLY: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default(''),
  SENTRY_DSN: z.string().optional().default(''),
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    .regex(/^[0-9a-f]+$/i, 'ENCRYPTION_KEY must be valid hexadecimal'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/* ------------------------------------------------------------------ */
/*  Client environment schema                                         */
/* ------------------------------------------------------------------ */

const clientEnvSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.string().min(1, 'NEXT_PUBLIC_CONVEX_URL is required'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  // Polar product ids the client uses to build checkout links to the server
  // /api/checkout route. Polar's redirect checkout needs no public client token
  // (unlike Paddle.js), so there is no NEXT_PUBLIC token here.
  NEXT_PUBLIC_POLAR_PRODUCT_LETTER: z.string().optional().default(''),
  NEXT_PUBLIC_POLAR_PRODUCT_MONTHLY: z.string().optional().default(''),
  NEXT_PUBLIC_POLAR_PRODUCT_YEARLY: z.string().optional().default(''),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                */
/* ------------------------------------------------------------------ */

function validateServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.format();
    console.error('Invalid server environment variables:', formatted);
    throw new Error(
      `Missing or invalid server environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}

function validateClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POLAR_PRODUCT_LETTER: process.env.NEXT_PUBLIC_POLAR_PRODUCT_LETTER,
    NEXT_PUBLIC_POLAR_PRODUCT_MONTHLY: process.env.NEXT_PUBLIC_POLAR_PRODUCT_MONTHLY,
    NEXT_PUBLIC_POLAR_PRODUCT_YEARLY: process.env.NEXT_PUBLIC_POLAR_PRODUCT_YEARLY,
  });
  if (!parsed.success) {
    const formatted = parsed.error.format();
    console.error('Invalid client environment variables:', formatted);
    throw new Error(
      `Missing or invalid client environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}

/* ------------------------------------------------------------------ */
/*  Exported typed env objects                                        */
/* ------------------------------------------------------------------ */

/**
 * `serverEnv` contains all server-side environment variables.
 * Only import this in server code (API routes, server components, etc.).
 *
 * Validation is LAZY: it runs on first property access, not at import. This is
 * deliberate — `next build` imports server modules to collect page data, but the
 * runtime server env (OPENAI_API_KEY, ENCRYPTION_KEY, …) isn't present during the
 * build. Eager validation at import broke `pnpm build` ("Invalid server
 * environment variables"). Deferring to first access preserves the fail-fast
 * guarantee at runtime (the first request that reads env still throws if it's
 * missing) without failing the build.
 */
let _serverEnv: ServerEnv | null = null;
function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv must not be accessed on the client. Use clientEnv instead.',
    );
  }
  if (_serverEnv === null) {
    _serverEnv = validateServerEnv();
  }
  return _serverEnv;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Proxy requires a type assertion for the target object
export const serverEnv: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string | symbol): unknown {
    return getServerEnv()[prop as keyof ServerEnv];
  },
});

/**
 * `clientEnv` contains only NEXT_PUBLIC_ variables safe for the browser.
 * Can be imported anywhere.
 */
export const clientEnv: ClientEnv = validateClientEnv();
