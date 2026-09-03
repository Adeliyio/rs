/**
 * Tests for rate limiter configuration and headers.
 *
 * Does NOT test Redis operations (requires running Redis).
 * Tests the configuration, header generation, and limit values.
 */

import { afterEach, describe, it, expect } from 'vitest';
import {
  RATE_LIMITS,
  rateLimitHeaders,
  clientIp,
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

/**
 * SECURITY regression (CWE-290): the rate-limit key must NOT be derivable from a
 * client-controlled X-Forwarded-For token. The app sits behind a single Caddy
 * proxy that APPENDS the real peer IP to the RIGHT of any inbound XFF, so the
 * trustworthy value is the LAST entry — never `split(',')[0]`. These tests fail
 * the moment anyone reverts to taking the leftmost token.
 */
describe('clientIp — spoof-resistant rate-limit keying', () => {
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (origHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = origHops;
  });

  const h = (entries: Record<string, string>): Headers => new Headers(entries);

  it('with one proxy hop, uses the proxy-appended (rightmost) entry, not the spoofed leftmost', () => {
    delete process.env.TRUSTED_PROXY_HOPS; // default = 1 (Caddy)
    // Attacker sends `X-Forwarded-For: <spoof>`; Caddy appends the real client.
    const ip = clientIp(h({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }));
    expect(ip).toBe('203.0.113.9');
    expect(ip).not.toBe('1.1.1.1'); // the client-controlled token must never win
  });

  it('rotating the spoofed leftmost token does NOT change the key (defeats the bypass)', () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    const a = clientIp(h({ 'x-forwarded-for': 'aaa.aaa.aaa.aaa, 203.0.113.9' }));
    const b = clientIp(h({ 'x-forwarded-for': 'zzz.zzz.zzz.zzz, 203.0.113.9' }));
    expect(a).toBe(b); // same real client → same bucket regardless of spoof
    expect(a).toBe('203.0.113.9');
  });

  it('prefers cf-connecting-ip when present (unspoofable Cloudflare header)', () => {
    const ip = clientIp(
      h({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }),
    );
    expect(ip).toBe('198.51.100.7');
  });

  it('honours TRUSTED_PROXY_HOPS for multi-proxy chains', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    // spoof, then two trusted proxies appended: real client is 2 from the end.
    const ip = clientIp(h({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9, 10.0.0.1' }));
    expect(ip).toBe('203.0.113.9');
  });

  it('a single-entry (no-proxy) chain returns that entry, not out of bounds', () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    expect(clientIp(h({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip, then "unknown", when no XFF/CF present', () => {
    expect(clientIp(h({ 'x-real-ip': '203.0.113.5' }))).toBe('203.0.113.5');
    expect(clientIp(h({}))).toBe('unknown');
  });
});
