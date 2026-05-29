/**
 * Admin authentication helper — server-only.
 *
 * Verifies that the requesting user is an admin by checking
 * their email against the ADMIN_EMAILS environment variable
 * and optionally validating the request IP against an allowlist.
 *
 * SEC-04: IP allowlist for admin endpoints.
 * SEC-15: Structured for future migration to DB-based roles.
 * SEC-22: Logs failed admin access attempts.
 */

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/* ------------------------------------------------------------------ */
/*  Admin email set                                                   */
/* ------------------------------------------------------------------ */

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/* ------------------------------------------------------------------ */
/*  IP allowlist (SEC-04)                                             */
/* ------------------------------------------------------------------ */

/**
 * Optional IP allowlist for admin endpoints. When set, only requests
 * from these IPs (or CIDR-free addresses) are allowed to access admin
 * routes. When empty, any IP with a valid admin email is allowed.
 *
 * Format: comma-separated IPs in ADMIN_IP_ALLOWLIST env var.
 * Example: "1.2.3.4,5.6.7.8,::1,127.0.0.1"
 */
const ADMIN_IP_ALLOWLIST = new Set(
  (process.env.ADMIN_IP_ALLOWLIST ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
);

/** Whether IP allowlist enforcement is active. */
export const IP_ALLOWLIST_ENABLED = ADMIN_IP_ALLOWLIST.size > 0;

/**
 * Extracts the client IP from the request headers.
 * Checks X-Forwarded-For (Cloudflare/proxy) first, then falls back
 * to CF-Connecting-IP and X-Real-IP.
 */
export function getClientIp(): string {
  let h: Headers;
  try {
    // next/headers is only available during request processing
    h = headers() as unknown as Headers;
  } catch {
    return 'unknown';
  }

  // Cloudflare / reverse proxy chain
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For may contain a chain: "client, proxy1, proxy2"
    return forwarded.split(',')[0]!.trim();
  }

  return h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? 'unknown';
}

/* ------------------------------------------------------------------ */
/*  Result type                                                       */
/* ------------------------------------------------------------------ */

export interface AdminAuthResult {
  authorized: boolean;
  userId?: string;
  email?: string;
  error?: string;
  /** IP address of the requester (for audit logging). */
  ip?: string;
}

/* ------------------------------------------------------------------ */
/*  Failed attempt logging (SEC-22)                                   */
/* ------------------------------------------------------------------ */

/**
 * Logs failed admin access attempts. Uses console.warn for now;
 * Phase 3 will migrate this to the audit_log table.
 */
function logFailedAdminAccess(
  reason: string,
  details: { userId?: string; email?: string; ip: string },
): void {
  // eslint-disable-next-line no-console
  console.warn(
    `[ADMIN AUTH DENIED] reason=${reason} email=${details.email ?? 'none'} ` +
      `userId=${details.userId ?? 'none'} ip=${details.ip} ts=${new Date().toISOString()}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Core auth check                                                   */
/* ------------------------------------------------------------------ */

/**
 * Checks if the current request is from an authenticated admin user.
 * Validates email whitelist and optionally IP allowlist.
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const ip = getClientIp();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    logFailedAdminAccess('unauthenticated', { ip });
    return { authorized: false, error: 'Unauthorized', ip };
  }

  const email = user.email?.toLowerCase() ?? '';

  if (!ADMIN_EMAILS.has(email)) {
    logFailedAdminAccess('not_admin_email', { userId: user.id, email, ip });
    return { authorized: false, userId: user.id, email, error: 'Forbidden', ip };
  }

  // SEC-04: IP allowlist check (only when allowlist is configured)
  if (IP_ALLOWLIST_ENABLED && !ADMIN_IP_ALLOWLIST.has(ip)) {
    logFailedAdminAccess('ip_not_allowed', { userId: user.id, email, ip });
    return { authorized: false, userId: user.id, email, error: 'Forbidden', ip };
  }

  return { authorized: true, userId: user.id, email, ip };
}
