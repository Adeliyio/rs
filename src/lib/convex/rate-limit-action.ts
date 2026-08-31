'use server';

import { headers } from 'next/headers';

import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Server action wrapping the Redis auth rate limiter, callable from the
 * client-side auth flows (useResolvaioAuth). Preserves the old per-IP
 * brute-force / enumeration protection (VULN-08) even though the Better Auth
 * sign-in call itself now runs client-side.
 */
export async function checkAuthRateLimit(
  bucket: 'login' | 'signup' | 'reset',
): Promise<{ allowed: boolean }> {
  const h = headers();
  const cf = h.get('cf-connecting-ip');
  const fwd = h.get('x-forwarded-for');
  const ip = cf ?? (fwd ? fwd.split(',')[0]!.trim() : h.get('x-real-ip') ?? 'unknown');

  try {
    const result = await checkRateLimit('auth', `${bucket}:${ip}`);
    return { allowed: result.allowed };
  } catch {
    // Fail OPEN: if the rate limiter (Redis) is unavailable, never block a
    // legitimate signup/login over an infrastructure blip. A thrown error here
    // used to escape the client auth call entirely, leaving the form frozen
    // with no message. The auth provider still enforces its own protections.
    return { allowed: true };
  }
}
