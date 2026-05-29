import { z } from 'zod';

/* ------------------------------------------------------------------ */
/*  Server environment schema                                         */
/* ------------------------------------------------------------------ */

const serverEnvSchema = z.object({
  // Core — Supabase. REQUIRED — app will not boot without these.
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  APP_URL: z.string().min(1).default('http://localhost:3000'),

  // AI — required for generation
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // Feature-specific — required when feature is used
  TAVILY_API_KEY: z.string().optional().default(''),
  PADDLE_API_KEY: z.string().optional().default(''),
  PADDLE_WEBHOOK_SECRET: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default(''),
  SENTRY_DSN: z.string().optional().default(''),
  ENCRYPTION_KEY: z.string().optional().default(''),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/* ------------------------------------------------------------------ */
/*  Client environment schema                                         */
/* ------------------------------------------------------------------ */

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().optional().default(''),
  NEXT_PUBLIC_PADDLE_ENVIRONMENT: z
    .enum(['sandbox', 'production'])
    .optional()
    .default('sandbox'),
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
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
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
 * Crashes on boot if any required variable is missing.
 */
export const serverEnv: ServerEnv =
  typeof window === 'undefined'
    ? validateServerEnv()
    : // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Proxy requires type assertion for the target object
      (new Proxy({} as ServerEnv, {
        get(): never {
          throw new Error(
            'serverEnv must not be accessed on the client. Use clientEnv instead.',
          );
        },
      }));

/**
 * `clientEnv` contains only NEXT_PUBLIC_ variables safe for the browser.
 * Can be imported anywhere.
 */
export const clientEnv: ClientEnv = validateClientEnv();
