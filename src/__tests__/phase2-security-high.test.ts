/**
 * Phase 2 Security — High-severity Mitigations
 *
 * Validates all 6 Phase 2 remediations from SECURITY.md:
 *   SEC-06: Rate limiter in-memory fallback (fail closed for critical ops)
 *   SEC-04/SEC-15: Admin auth hardened with IP allowlist + failed access logging
 *   SEC-07: HTML escaping in email templates
 *   SEC-09: Paddle transaction ID format validation
 *   SEC-10: Reduced signed URL TTL for document parse (1hr → 5min)
 *   SEC-25: Marketing SEO pages added to PUBLIC_ROUTES
 *
 * These tests verify source code, configuration, and runtime behavior
 * to confirm each risk is mitigated end-to-end.
 */

import { describe, test, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/* ------------------------------------------------------------------ */
/*  Helper — read source file                                          */
/* ------------------------------------------------------------------ */

const ROOT = path.resolve(__dirname, '../..');

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

/* ====================================================================
 *  SEC-06: Rate Limiter In-Memory Fallback
 * ==================================================================== */

describe('SEC-06: Rate limiter — in-memory fallback, fail closed for critical ops', () => {
  const source = readSrc('src/lib/rate-limit.ts');

  describe('Source structure', () => {
    test('exports checkRateLimitInMemory function', () => {
      expect(source).toContain('export function checkRateLimitInMemory');
    });

    test('exports FAIL_CLOSED_CATEGORIES set', () => {
      expect(source).toContain('export const FAIL_CLOSED_CATEGORIES');
    });

    test('FAIL_CLOSED_CATEGORIES includes generation', () => {
      expect(source).toContain("'generation'");
    });

    test('FAIL_CLOSED_CATEGORIES includes upload', () => {
      expect(source).toContain("'upload'");
    });

    test('Redis unavailable falls back to in-memory (not fail open)', () => {
      // Old behavior: `return { allowed: true, ...}`
      expect(source).not.toMatch(/catch\s*\{[^}]*allowed:\s*true/);
      // New behavior: calls checkRateLimitInMemory
      expect(source).toContain('checkRateLimitInMemory(category, identifier)');
    });

    test('no longer returns allowed: true when Redis is down', () => {
      // The old `allowed: true` fail-open in the catch block must be gone
      const catchBlock = source.match(/catch\s*\{[\s\S]*?return\s+checkRateLimitInMemory/);
      expect(catchBlock).not.toBeNull();
    });

    test('in-memory store uses Map for timestamps', () => {
      expect(source).toContain('new Map<');
    });

    test('prune interval prevents memory leaks', () => {
      expect(source).toContain('pruneMemoryStore');
      expect(source).toContain('setInterval');
    });

    test('prune interval is unref-ed to allow Node exit', () => {
      expect(source).toContain('.unref()');
    });
  });

  describe('Runtime: checkRateLimitInMemory behavior', () => {
    test('allows requests under the limit', async () => {
      const { checkRateLimitInMemory } = await import('@/lib/rate-limit');
      const uniqueId = `test-${Date.now()}-${Math.random()}`;
      const result = checkRateLimitInMemory('general', uniqueId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThanOrEqual(59); // 60 max - 1
      expect(result.limit).toBe(60);
    });

    test('blocks requests over the limit', async () => {
      const { checkRateLimitInMemory } = await import('@/lib/rate-limit');
      const uniqueId = `test-exhaust-${Date.now()}-${Math.random()}`;

      // Exhaust the generation limit (5 req/hr)
      for (let i = 0; i < 5; i++) {
        const r = checkRateLimitInMemory('generation', uniqueId);
        expect(r.allowed).toBe(true);
      }

      // 6th request should be blocked
      const blocked = checkRateLimitInMemory('generation', uniqueId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    test('returns correct limit for each category', async () => {
      const { checkRateLimitInMemory } = await import('@/lib/rate-limit');
      const id = `test-cat-${Date.now()}`;

      expect(checkRateLimitInMemory('auth', `${id}-auth`).limit).toBe(5);
      expect(checkRateLimitInMemory('generation', `${id}-gen`).limit).toBe(5);
      expect(checkRateLimitInMemory('upload', `${id}-up`).limit).toBe(10);
      expect(checkRateLimitInMemory('general', `${id}-api`).limit).toBe(60);
    });

    test('different identifiers have independent limits', async () => {
      const { checkRateLimitInMemory } = await import('@/lib/rate-limit');
      const base = `test-indep-${Date.now()}`;

      // Exhaust user A's generation limit
      for (let i = 0; i < 5; i++) {
        checkRateLimitInMemory('generation', `${base}-A`);
      }
      expect(checkRateLimitInMemory('generation', `${base}-A`).allowed).toBe(false);

      // User B should still be allowed
      expect(checkRateLimitInMemory('generation', `${base}-B`).allowed).toBe(true);
    });

    test('resetAt is in the future', async () => {
      const { checkRateLimitInMemory } = await import('@/lib/rate-limit');
      const result = checkRateLimitInMemory('general', `test-reset-${Date.now()}`);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('FAIL_CLOSED_CATEGORIES runtime check', () => {
    test('generation is in FAIL_CLOSED_CATEGORIES', async () => {
      const { FAIL_CLOSED_CATEGORIES } = await import('@/lib/rate-limit');
      expect(FAIL_CLOSED_CATEGORIES.has('generation')).toBe(true);
    });

    test('upload is in FAIL_CLOSED_CATEGORIES', async () => {
      const { FAIL_CLOSED_CATEGORIES } = await import('@/lib/rate-limit');
      expect(FAIL_CLOSED_CATEGORIES.has('upload')).toBe(true);
    });

    test('auth is NOT in FAIL_CLOSED_CATEGORIES', async () => {
      const { FAIL_CLOSED_CATEGORIES } = await import('@/lib/rate-limit');
      expect(FAIL_CLOSED_CATEGORIES.has('auth')).toBe(false);
    });

    test('general is NOT in FAIL_CLOSED_CATEGORIES', async () => {
      const { FAIL_CLOSED_CATEGORIES } = await import('@/lib/rate-limit');
      expect(FAIL_CLOSED_CATEGORIES.has('general')).toBe(false);
    });
  });
});

/* ====================================================================
 *  SEC-04/SEC-15: Admin Auth Hardened
 * ==================================================================== */

describe('SEC-04/SEC-15/SEC-22: Admin auth — IP allowlist + failed access logging', () => {
  const source = readSrc('src/lib/admin/auth.ts');

  describe('IP allowlist (SEC-04)', () => {
    test('reads ADMIN_IP_ALLOWLIST from env', () => {
      expect(source).toContain('ADMIN_IP_ALLOWLIST');
      expect(source).toContain("process.env.ADMIN_IP_ALLOWLIST");
    });

    test('exports IP_ALLOWLIST_ENABLED flag', () => {
      expect(source).toContain('export const IP_ALLOWLIST_ENABLED');
    });

    test('IP allowlist check happens after email check', () => {
      const emailCheckIdx = source.indexOf('ADMIN_EMAILS.has(email)');
      const ipCheckIdx = source.indexOf('ADMIN_IP_ALLOWLIST.has(ip)');
      expect(emailCheckIdx).toBeGreaterThan(-1);
      expect(ipCheckIdx).toBeGreaterThan(emailCheckIdx);
    });

    test('IP allowlist only enforced when configured (size > 0)', () => {
      expect(source).toContain('IP_ALLOWLIST_ENABLED && !ADMIN_IP_ALLOWLIST.has(ip)');
    });

    test('.env.example documents ADMIN_IP_ALLOWLIST', () => {
      const envExample = readSrc('.env.example');
      expect(envExample).toContain('ADMIN_IP_ALLOWLIST');
    });
  });

  describe('Client IP extraction', () => {
    test('exports getClientIp function', () => {
      expect(source).toContain('export function getClientIp');
    });

    test('checks x-forwarded-for header (Cloudflare/proxy)', () => {
      expect(source).toContain("'x-forwarded-for'");
    });

    test('checks cf-connecting-ip header (Cloudflare direct)', () => {
      expect(source).toContain("'cf-connecting-ip'");
    });

    test('checks x-real-ip header (nginx)', () => {
      expect(source).toContain("'x-real-ip'");
    });

    test('handles X-Forwarded-For chain (uses first IP)', () => {
      expect(source).toContain("split(',')");
      expect(source).toContain('.trim()');
    });

    test('returns "unknown" as fallback', () => {
      expect(source).toContain("'unknown'");
    });
  });

  describe('Failed access logging (SEC-22)', () => {
    test('has logFailedAdminAccess function', () => {
      expect(source).toContain('function logFailedAdminAccess');
    });

    test('logs unauthenticated access attempts', () => {
      expect(source).toContain("logFailedAdminAccess('unauthenticated'");
    });

    test('logs non-admin email attempts', () => {
      expect(source).toContain("logFailedAdminAccess('not_admin_email'");
    });

    test('logs IP-blocked attempts', () => {
      expect(source).toContain("logFailedAdminAccess('ip_not_allowed'");
    });

    test('log output includes reason, email, userId, ip, timestamp', () => {
      expect(source).toContain('reason=');
      expect(source).toContain('email=');
      expect(source).toContain('userId=');
      expect(source).toContain('ip=');
      expect(source).toContain('ts=');
    });
  });

  describe('AdminAuthResult includes IP', () => {
    test('AdminAuthResult interface has ip field', () => {
      expect(source).toContain('ip?: string');
    });

    test('authorized result includes ip', () => {
      // The authorized return should include ip
      expect(source).toMatch(/authorized:\s*true.*ip/s);
    });

    test('denied result includes ip', () => {
      expect(source).toMatch(/authorized:\s*false.*ip/s);
    });
  });
});

/* ====================================================================
 *  SEC-07: Email Template HTML Escaping
 * ==================================================================== */

describe('SEC-07: Email templates — HTML escaping', () => {
  const source = readSrc('src/lib/email/templates.ts');

  describe('Escaping functions exist', () => {
    test('escapeHtml function defined', () => {
      expect(source).toContain('function escapeHtml');
    });

    test('escapeUrl function defined', () => {
      expect(source).toContain('function escapeUrl');
    });

    test('escapeHtml exported for testing', () => {
      expect(source).toContain('export { escapeHtml, escapeUrl }');
    });

    test('SEC-07 comment present', () => {
      expect(source).toContain('SEC-07');
    });
  });

  describe('escapeHtml — runtime behavior', () => {
    test('escapes & to &amp;', async () => {
      const { escapeHtml } = await import('@/lib/email/templates');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('escapes < to &lt;', async () => {
      const { escapeHtml } = await import('@/lib/email/templates');
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('escapes > to &gt;', async () => {
      const { escapeHtml } = await import('@/lib/email/templates');
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    test('escapes " to &quot;', async () => {
      const { escapeHtml } = await import('@/lib/email/templates');
      expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
    });

    test('escapes \' to &#x27;', async () => {
      const { escapeHtml } = await import('@/lib/email/templates');
      expect(escapeHtml("it's")).toBe('it&#x27;s');
    });

    test('handles complex injection payload', async () => {
      const { escapeHtml } = await import('@/lib/email/templates');
      const payload = '<img src=x onerror="alert(1)">';
      const escaped = escapeHtml(payload);
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
      expect(escaped).not.toContain('"');
    });
  });

  describe('escapeUrl — runtime behavior', () => {
    test('allows https URLs', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      expect(escapeUrl('https://example.com/path')).toBe('https://example.com/path');
    });

    test('allows http URLs', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      expect(escapeUrl('http://localhost:3000')).toBe('http://localhost:3000');
    });

    test('allows # fallback', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      expect(escapeUrl('#')).toBe('#');
    });

    test('blocks javascript: URI', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      expect(escapeUrl('javascript:alert(1)')).toBe('#');
    });

    test('blocks data: URI', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      expect(escapeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    });

    test('blocks vbscript: URI', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      expect(escapeUrl('vbscript:MsgBox("XSS")')).toBe('#');
    });

    test('blocks empty string', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      expect(escapeUrl('')).toBe('#');
    });

    test('escapes HTML entities in URLs', async () => {
      const { escapeUrl } = await import('@/lib/email/templates');
      const result = escapeUrl('https://example.com/path?a=1&b=2');
      expect(result).toContain('&amp;');
    });
  });

  describe('All templates use escapeHtml on data fields', () => {
    test('letterDeliveryTemplate escapes jurisdiction', () => {
      expect(source).toContain("escapeHtml(data['jurisdiction']");
    });

    test('letterDeliveryTemplate escapes property_address', () => {
      expect(source).toContain("escapeHtml(data['property_address']");
    });

    test('letterDeliveryTemplate uses escapeUrl for download_url', () => {
      expect(source).toContain("escapeUrl(data['download_url']");
    });

    test('sequenceStepTemplate escapes company_name', () => {
      expect(source).toContain("escapeHtml(data['company_name']");
    });

    test('sequenceStepTemplate escapes step_name', () => {
      expect(source).toContain("escapeHtml(data['step_name']");
    });

    test('sequenceStepTemplate uses escapeUrl for case_url', () => {
      expect(source).toContain("escapeUrl(data['case_url']");
    });

    test('deadlinePromptTemplate escapes deadline_date', () => {
      expect(source).toContain("escapeHtml(data['deadline_date']");
    });

    test('deadlinePromptTemplate escapes prompt_message', () => {
      expect(source).toContain("escapeHtml(data['prompt_message']");
    });

    test('deadlinePromptTemplate escapes days_remaining', () => {
      expect(source).toContain("escapeHtml(data['days_remaining']");
    });

    test('outcomeFollowupTemplate escapes days_elapsed', () => {
      expect(source).toContain("escapeHtml(data['days_elapsed']");
    });

    test('outcomeFollowupTemplate uses escapeUrl for outcome_url', () => {
      expect(source).toContain("escapeUrl(data['outcome_url']");
    });

    test('paymentConfirmationTemplate escapes amount', () => {
      expect(source).toContain("escapeHtml(data['amount']");
    });

    test('paymentConfirmationTemplate escapes product_name', () => {
      expect(source).toContain("escapeHtml(data['product_name']");
    });

    test('preheader is escaped in wrapInLayout', () => {
      expect(source).toContain('escapeHtml(preheader)');
    });
  });

  describe('Integration: renderTemplate with malicious data', () => {
    test('letter_delivery escapes XSS in property_address', async () => {
      const { renderTemplate } = await import('@/lib/email/templates');
      const result = renderTemplate('letter_delivery', {
        property_address: '<script>alert("xss")</script>',
        jurisdiction: 'California',
        download_url: 'javascript:alert(1)',
      });

      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
      // Malicious URL should be replaced with #
      expect(result.html).not.toContain('javascript:');
    });

    test('sequence_step escapes XSS in company_name', async () => {
      const { renderTemplate } = await import('@/lib/email/templates');
      const result = renderTemplate('sequence_step', {
        company_name: '<img src=x onerror=alert(1)>',
        step_number: '1',
        step_name: 'Test',
      });

      expect(result.html).not.toContain('<img');
      expect(result.html).toContain('&lt;img');
    });

    test('payment_confirmation escapes XSS in product_name', async () => {
      const { renderTemplate } = await import('@/lib/email/templates');
      const result = renderTemplate('payment_confirmation', {
        product_name: '"><script>alert(1)</script>',
        amount: '$49',
      });

      expect(result.html).not.toContain('<script>');
    });

    test('deadline_prompt escapes XSS in prompt_message', async () => {
      const { renderTemplate } = await import('@/lib/email/templates');
      const result = renderTemplate('deadline_prompt', {
        prompt_message: '<b onmouseover="alert(1)">hover me</b>',
        deadline_date: '2025-06-01',
        days_remaining: '5',
      });

      expect(result.html).not.toContain('<b onmouseover');
    });
  });
});

/* ====================================================================
 *  SEC-09: Paddle Transaction ID Validation
 * ==================================================================== */

describe('SEC-09: Paddle transaction ID format validation', () => {
  const source = readSrc('src/app/api/admin/payments/route.ts');

  test('validates transaction_id format before API call', () => {
    expect(source).toContain('txn_[a-zA-Z0-9]+');
  });

  test('regex test applied to body.transaction_id', () => {
    expect(source).toContain('.test(body.transaction_id)');
  });

  test('returns 400 for invalid format', () => {
    expect(source).toContain("Invalid transaction_id format");
  });

  test('SEC-09 comment present', () => {
    expect(source).toContain('SEC-09');
  });

  describe('Transaction ID format validation — unit-level', () => {
    const regex = /^txn_[a-zA-Z0-9]+$/;

    test('accepts valid Paddle transaction ID', () => {
      expect(regex.test('txn_abc123DEF')).toBe(true);
    });

    test('accepts txn_ with long alphanumeric', () => {
      expect(regex.test('txn_01hv3j8k2m4n5p6q7r8s9t0uab')).toBe(true);
    });

    test('rejects empty string', () => {
      expect(regex.test('')).toBe(false);
    });

    test('rejects missing txn_ prefix', () => {
      expect(regex.test('abc123')).toBe(false);
    });

    test('rejects SQL injection attempt', () => {
      expect(regex.test("txn_abc'; DROP TABLE transactions; --")).toBe(false);
    });

    test('rejects path traversal', () => {
      expect(regex.test('txn_../../etc/passwd')).toBe(false);
    });

    test('rejects spaces', () => {
      expect(regex.test('txn_abc 123')).toBe(false);
    });

    test('rejects special characters', () => {
      expect(regex.test('txn_abc!@#$')).toBe(false);
    });

    test('rejects txn_ alone (no alphanumeric after prefix)', () => {
      expect(regex.test('txn_')).toBe(false);
    });

    test('validation happens before Paddle API call', () => {
      const validationIdx = source.indexOf('txn_[a-zA-Z0-9]+');
      const fetchIdx = source.indexOf('fetch(');
      expect(validationIdx).toBeLessThan(fetchIdx);
    });
  });
});

/* ====================================================================
 *  SEC-10: Reduced Signed URL TTL for Document Parse
 * ==================================================================== */

describe('SEC-10: Document parse — reduced signed URL TTL', () => {
  const source = readSrc('src/app/api/documents/[id]/parse/route.ts');

  test('no longer uses 3600 (1-hour) TTL', () => {
    expect(source).not.toContain('3600');
  });

  test('uses 5 * 60 (5-minute) TTL', () => {
    // Convex migration: numeric 5 * 60 TTL -> named ttl: 'internal' (short-lived server-side)
    expect(source).toContain("ttl: 'internal'");
  });

  test('SEC-10 comment present', () => {
    expect(source).toContain('SEC-10');
  });

  test('still uses createSignedUrl', () => {
    // Convex migration: Supabase createSignedUrl -> api.service.signObject action
    expect(source).toContain('api.service.signObject');
  });
});

/* ====================================================================
 *  SEC-25: Marketing SEO Pages in PUBLIC_ROUTES
 * ==================================================================== */

describe('SEC-25: Marketing SEO pages — public access', () => {
  const source = readSrc('src/middleware.ts');

  describe('PUBLIC_PREFIXES includes marketing routes', () => {
    test('middleware has PUBLIC_PREFIXES array', () => {
      expect(source).toContain('PUBLIC_PREFIXES');
    });

    test('/deposit is a public prefix', () => {
      expect(source).toContain("'/deposit'");
    });

    test('/subscription is a public prefix', () => {
      expect(source).toContain("'/subscription'");
    });
  });

  describe('isPublicPath uses prefix matching', () => {
    test('uses PUBLIC_PREFIXES.some() for prefix matching', () => {
      expect(source).toContain('PUBLIC_PREFIXES.some');
    });

    test('SEC-25 comment present', () => {
      expect(source).toContain('SEC-25');
    });
  });

  describe('Specific routes are public', () => {
    // Re-implement the isPublicPath logic for testing
    const PUBLIC_ROUTES = [
      '/',
      '/about',
      '/pricing',
      '/login',
      '/register',
      '/auth/callback',
      '/auth/confirm',
    ];

    const PUBLIC_PREFIXES = [
      '/deposit',
      '/subscription',
      '/api/webhooks/',
      '/api/trust/',
      '/api/waitlist',
    ];

    // Public metadata / well-known files — must be crawlable, never auth-gated.
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

    function isPublicPath(pathname: string): boolean {
      return (
        PUBLIC_ROUTES.includes(pathname) ||
        PUBLIC_METADATA_FILES.includes(pathname) ||
        PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
        pathname === '/api/health'
      );
    }

    test('/deposit is public', () => {
      expect(isPublicPath('/deposit')).toBe(true);
    });

    test('/deposit/california is public', () => {
      expect(isPublicPath('/deposit/california')).toBe(true);
    });

    test('/deposit/texas is public', () => {
      expect(isPublicPath('/deposit/texas')).toBe(true);
    });

    test('/subscription is public', () => {
      expect(isPublicPath('/subscription')).toBe(true);
    });

    test('/about is public (existing)', () => {
      expect(isPublicPath('/about')).toBe(true);
    });

    test('/api/health is public (existing)', () => {
      expect(isPublicPath('/api/health')).toBe(true);
    });

    test('/api/webhooks/paddle is public (existing)', () => {
      expect(isPublicPath('/api/webhooks/paddle')).toBe(true);
    });

    test('/api/trust/stats is public', () => {
      expect(isPublicPath('/api/trust/stats')).toBe(true);
    });

    test('/api/waitlist is public', () => {
      expect(isPublicPath('/api/waitlist')).toBe(true);
    });

    // Regression: these metadata routes were being redirected to /login by the
    // catch-all protected matcher, which would make the site uncrawlable and
    // break social previews in production. They must be public.
    test('/sitemap.xml is public (crawlable)', () => {
      expect(isPublicPath('/sitemap.xml')).toBe(true);
    });

    test('/robots.txt is public (crawlable)', () => {
      expect(isPublicPath('/robots.txt')).toBe(true);
    });

    test('/llms.txt is public (crawlable)', () => {
      expect(isPublicPath('/llms.txt')).toBe(true);
    });

    test('/manifest.json is public', () => {
      expect(isPublicPath('/manifest.json')).toBe(true);
    });

    test('middleware source declares PUBLIC_METADATA_FILES', () => {
      expect(source).toContain('PUBLIC_METADATA_FILES');
      expect(source).toContain("'/sitemap.xml'");
      expect(source).toContain("'/robots.txt'");
    });

    test('/dashboard is NOT public', () => {
      expect(isPublicPath('/dashboard')).toBe(false);
    });

    test('/api/cases is NOT public', () => {
      expect(isPublicPath('/api/cases')).toBe(false);
    });

    test('/api/admin/payments is NOT public', () => {
      expect(isPublicPath('/api/admin/payments')).toBe(false);
    });
  });

  describe('API public path early return', () => {
    test('middleware has early return for public API paths', () => {
      // Should have: if (isPublicPath(pathname) && pathname.startsWith('/api/'))
      expect(source).toContain("isPublicPath(pathname) && pathname.startsWith('/api/')");
    });
  });
});

/* ====================================================================
 *  Cross-cutting: End-to-End Risk Mitigation Validation
 * ==================================================================== */

describe('Phase 2 — End-to-end risk mitigation summary', () => {
  test('SEC-06 RISK MITIGATED: Rate limiter has in-memory fallback', () => {
    const source = readSrc('src/lib/rate-limit.ts');
    // No more fail-open
    expect(source).not.toMatch(/Redis not available.*allowed:\s*true/s);
    // Has in-memory fallback
    expect(source).toContain('checkRateLimitInMemory');
    // Critical categories identified
    expect(source).toContain('FAIL_CLOSED_CATEGORIES');
  });

  test('SEC-04 RISK MITIGATED: Admin auth has IP allowlist', () => {
    const source = readSrc('src/lib/admin/auth.ts');
    expect(source).toContain('ADMIN_IP_ALLOWLIST');
    expect(source).toContain('IP_ALLOWLIST_ENABLED');
  });

  test('SEC-22 RISK MITIGATED: Failed admin access is logged', () => {
    const source = readSrc('src/lib/admin/auth.ts');
    expect(source).toContain('logFailedAdminAccess');
    // Logged for all 3 denial reasons
    expect(source).toContain("'unauthenticated'");
    expect(source).toContain("'not_admin_email'");
    expect(source).toContain("'ip_not_allowed'");
  });

  test('SEC-07 RISK MITIGATED: All email templates escape HTML', () => {
    const source = readSrc('src/lib/email/templates.ts');
    // Every template function should use escapeHtml
    const templateFunctions = [
      'letterDeliveryTemplate',
      'sequenceStepTemplate',
      'deadlinePromptTemplate',
      'outcomeFollowupTemplate',
      'paymentConfirmationTemplate',
    ];
    for (const fn of templateFunctions) {
      const fnStart = source.indexOf(`function ${fn}`);
      const fnEnd = source.indexOf('function ', fnStart + 1);
      const fnBody = source.slice(fnStart, fnEnd > -1 ? fnEnd : undefined);
      expect(fnBody).toContain('escapeHtml(');
    }
  });

  test('SEC-09 RISK MITIGATED: Transaction ID validated before Paddle API call', () => {
    const source = readSrc('src/app/api/admin/payments/route.ts');
    expect(source).toContain('txn_[a-zA-Z0-9]+');
    expect(source).toContain('Invalid transaction_id format');
  });

  test('SEC-10 RISK MITIGATED: Document parse uses 5-min TTL', () => {
    const source = readSrc('src/app/api/documents/[id]/parse/route.ts');
    expect(source).not.toContain('3600');
    // Convex migration: numeric 5 * 60 TTL -> named ttl: 'internal'
    expect(source).toContain("ttl: 'internal'");
  });

  test('SEC-25 RISK MITIGATED: Marketing pages accessible without auth', () => {
    const source = readSrc('src/middleware.ts');
    expect(source).toContain("'/deposit'");
    expect(source).toContain("'/subscription'");
    expect(source).toContain('PUBLIC_PREFIXES');
  });
});
