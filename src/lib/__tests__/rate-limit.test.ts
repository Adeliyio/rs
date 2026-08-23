/**
 * Tests for rate limiter configuration and headers.
 *
 * Does NOT test Redis operations (requires running Redis).
 * Tests the configuration, header generation, and limit values.
 */

import { describe, it, expect } from 'vitest';
import {
  RATE_LIMITS,
  rateLimitHeaders,
  type RateLimitResult,
} from '@/lib/rate-limit';

describe('RATE_LIMITS configuration', () => {
  it('auth limit is 5 per 15 minutes', () => {
    expect(RATE_LIMITS.auth.max).toBe(5);
    expect(RATE_LIMITS.auth.windowSeconds).toBe(15 * 60);
  });

  it('generation limit is 5 per hour', () => {
    expect(RATE_LIMITS.generation.max).toBe(5);
    expect(RATE_LIMITS.generation.windowSeconds).toBe(60 * 60);
  });

  it('upload limit is 10 per hour', () => {
    expect(RATE_LIMITS.upload.max).toBe(10);
    expect(RATE_LIMITS.upload.windowSeconds).toBe(60 * 60);
  });

  it('general limit is 60 per minute', () => {
    expect(RATE_LIMITS.general.max).toBe(60);
    expect(RATE_LIMITS.general.windowSeconds).toBe(60);
  });
});

describe('rateLimitHeaders', () => {
  it('generates correct headers for allowed request', () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 4,
      resetAt: new Date('2025-02-10T12:05:00Z'),
      limit: 5,
    };

    const headers = rateLimitHeaders(result);
    expect(headers['X-RateLimit-Limit']).toBe('5');
    expect(headers['X-RateLimit-Remaining']).toBe('4');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('generates correct headers for denied request', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: new Date('2025-02-10T12:15:00Z'),
      limit: 5,
    };

    const headers = rateLimitHeaders(result);
    expect(headers['X-RateLimit-Limit']).toBe('5');
    expect(headers['X-RateLimit-Remaining']).toBe('0');
  });
});
