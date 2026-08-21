'use server';

import { headers } from 'next/headers';

import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Server action wrapping the Redis auth rate limiter, callable from the
 * client-side auth flows (useResolvaioAuth). Preserves the old per-IP
 * brute-force / enumeration protection (VULN-08) even though the Convex Auth
 * signIn call itself now runs client-side.
 */
export async function checkAuthRateLimit(
  bucket: 'login' | 'signup' | 'reset',
): Promise<{ allowed: boolean }> {
  const h = await headers();
  const cf = h.get('cf-connecting-ip');
  const fwd = h.get('x-forwarded-for');
  const ip = cf ?? (fwd ? fwd.split(',')[0]!.trim() : h.get('x-real-ip') ?? 'unknown');

  const result = await checkRateLimit('auth', `${bucket}:${ip}`);
  return { allowed: result.allowed };
}
