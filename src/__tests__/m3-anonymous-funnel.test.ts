/**
 * M3 — value-first funnel backend (SPEC.md §3, §5).
 *
 * Verifies the three PUBLIC anonymous endpoints exist, are declared public in
 * middleware, and enforce the cost/abuse and legal-safety boundaries: the
 * anonymous surface must never reach a paid OpenAI call, and the deterministic
 * value-reveal must be a KB read with no DB write.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function read(rel: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');
}

/* ================================================================== */
/*  1. The public endpoints exist                                     */
/* ================================================================== */

describe('M3: anonymous funnel endpoints exist', () => {
  it('has the public diagnostic preview endpoint', () => {
    expect(() => read('app/api/diagnostic/preview/route.ts')).not.toThrow();
  });

  it('has the public diagnostic graph endpoint', () => {
    expect(() => read('app/api/diagnostic/graph/route.ts')).not.toThrow();
  });

  it('has the public anonymous cancellation endpoint', () => {
    expect(() => read('app/api/diagnostic/cancellation/route.ts')).not.toThrow();
  });
});

/* ================================================================== */
/*  2. They are declared PUBLIC in middleware (no auth wall)          */
/* ================================================================== */

describe('M3: middleware exposes the anonymous routes', () => {
  const middleware = read('middleware.ts');

  it('preview is in PUBLIC_PREFIXES', () => {
    expect(middleware).toContain("'/api/diagnostic/preview'");
  });
  it('graph is in PUBLIC_PREFIXES', () => {
    expect(middleware).toContain("'/api/diagnostic/graph'");
  });
  it('cancellation is in PUBLIC_PREFIXES', () => {
    expect(middleware).toContain("'/api/diagnostic/cancellation'");
  });
  it('the app-only /api/diagnostic (state) prefix is still present (state stays gated)', () => {
    // The generic prefix remains app-only; only the three specific sub-paths
    // above are public (public API paths are matched first in the middleware).
    expect(middleware).toContain("'/api/diagnostic'");
  });
});

/* ================================================================== */
/*  3. Cost boundary — anonymous surface never calls paid AI          */
/* ================================================================== */

describe('M3: anonymous endpoints make no paid AI call', () => {
  it('preview does not import the OpenAI client or AI_CONFIG', () => {
    const src = read('app/api/diagnostic/preview/route.ts');
    expect(src).not.toContain('openai-client');
    expect(src).not.toContain('AI_CONFIG');
    // It is a deterministic KB read.
    expect(src).toContain('loadKbEntry');
  });

  it('cancellation goes through the deterministic template pipeline, not the LLM', () => {
    const src = read('app/api/diagnostic/cancellation/route.ts');
    // Uses the sequence generator (which M2 rewired to templates), never the
    // raw LLM generation function.
    expect(src).toContain('generateSequence');
    expect(src).not.toContain('openai-client');
    expect(src).not.toContain('AI_CONFIG');
  });

  it('cancellation writes nothing to the database (no case, no user)', () => {
    const src = read('app/api/diagnostic/cancellation/route.ts');
    // No Convex mutation / service client — it returns the sequence in the body.
    expect(src).not.toContain('createServiceConvexClient');
    expect(src).not.toContain('api.service.createSequence');
    expect(src).not.toContain('api.cases.create');
  });
});

/* ================================================================== */
/*  4. Rate limiting is applied (belt-and-suspenders, SPEC §5)        */
/* ================================================================== */

describe('M3: anonymous endpoints are rate-limited by IP', () => {
  it('preview rate-limits', () => {
    expect(read('app/api/diagnostic/preview/route.ts')).toContain('checkRateLimit');
  });
  it('cancellation rate-limits on the fail-closed generation bucket', () => {
    const src = read('app/api/diagnostic/cancellation/route.ts');
    expect(src).toContain('checkRateLimit');
    expect(src).toContain("'generation'");
  });
});

/* ================================================================== */
/*  5. Validation at the boundary (Zod)                               */
/* ================================================================== */

describe('M3: anonymous endpoints validate input with Zod', () => {
  it('preview validates with a Zod schema', () => {
    const src = read('app/api/diagnostic/preview/route.ts');
    expect(src).toContain("from 'zod'");
    expect(src).toContain('.safeParse(');
  });
  it('cancellation validates with a Zod schema', () => {
    const src = read('app/api/diagnostic/cancellation/route.ts');
    expect(src).toContain("from 'zod'");
    expect(src).toContain('.safeParse(');
  });
});
