/**
 * Phase 7 — Testing, Validation & Launch Readiness — Tests
 *
 * Validates:
 * - 7a: Regression suite D1-D20 and S1-S20 completeness
 * - 7b: E2E test coverage (Playwright specs exist for all critical paths)
 * - 7c: KB validation script correctness
 * - 7d: Load test script structure
 * - 7e: About page UPL compliance
 * - 7f: SEO landing pages with metadata, structured data, disclaimers
 *
 * Risk mitigations:
 * - R1: Regression tests handle async generation → verified queue + sync paths exist
 * - R2: Load test reveals Puppeteer bottleneck → circuit breaker from Phase 6 handles it
 * - R3: KB validation stale entries → staleness check in validate-kb.ts
 * - R4: E2E flaky from Paddle → Paddle mocked in E2E, tested manually in sandbox
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/* ================================================================== */
/*  Helper                                                            */
/* ================================================================== */

function readSource(relativePath: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, '..', relativePath),
    'utf-8',
  );
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(__dirname, '..', relativePath));
}

function readRoot(relativePath: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../..', relativePath),
    'utf-8',
  );
}

function rootExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(__dirname, '../..', relativePath));
}

/* ================================================================== */
/*  7a: Regression suite D1-D20 and S1-S20 completeness               */
/* ================================================================== */

describe('7a: Deposit regression suite (D1-D20)', () => {
  const source = readSource('__tests__/regression/deposit-cases.test.ts');

  it('deposit regression test file exists', () => {
    expect(fileExists('__tests__/regression/deposit-cases.test.ts')).toBe(true);
  });

  it('tests all 4 jurisdictions (CA, TX, NY, FL)', () => {
    expect(source).toContain("'CA'");
    expect(source).toContain("'TX'");
    expect(source).toContain("'NY'");
    expect(source).toContain("'FL'");
  });

  it('D1-D4: KB entry loading per jurisdiction', () => {
    expect(source).toContain('D1-D4: KB entry loading');
    expect(source).toContain('loadKbEntry');
    expect(source).toContain('statutes.length');
    expect(source).toContain('deadline_rules.length');
  });

  it('D5-D8: Grounding context assembly', () => {
    expect(source).toContain('D5-D8: Grounding context assembly');
    expect(source).toContain('assembleGroundingContext');
    expect(source).toContain('APPLICABLE STATUTES');
  });

  it('D9-D12: Compliance scanning', () => {
    expect(source).toContain('D9-D12: Compliance scanning');
    expect(source).toContain('scanCompliance');
    expect(source).toContain('result.pass');
  });

  it('D13-D16: Deadline computation', () => {
    expect(source).toContain('D13-D16: Deadline computation');
    expect(source).toContain('computeDeadlines');
    expect(source).toContain('move_out');
  });

  it('D17-D20: Packet template availability', () => {
    expect(source).toContain('D17-D20: Packet template');
    expect(source).toContain('loadSmallClaimsPacket');
    expect(source).toContain('loadStateAgPacket');
    expect(source).toContain('validateCitations');
  });
});

describe('7a: Subscription regression suite (S1-S20)', () => {
  const source = readSource('__tests__/regression/subscription-cases.test.ts');

  it('subscription regression test file exists', () => {
    expect(
      fileExists('__tests__/regression/subscription-cases.test.ts'),
    ).toBe(true);
  });

  it('S1-S3: Federal KB verification', () => {
    expect(source).toContain('S1-S3: Federal KB verification');
    expect(source).toContain('rosca');
    expect(source).toContain('fcba');
    expect(source).toContain('ftc-negative-option-rule-1973');
  });

  it('S4-S6: State-specific KB', () => {
    expect(source).toContain('S4-S6: State KB');
    expect(source).toContain('ca-arl-17600');
    expect(source).toContain('ny-gbl-349');
  });

  it('S7-S10: Compliance on subscription text', () => {
    expect(source).toContain('S7-S10: Compliance');
    expect(source).toContain('prohibited phrases caught');
  });

  it('S11-S14: Email template rendering', () => {
    expect(source).toContain('S11-S14: Email templates');
    expect(source).toContain('renderTemplate');
    expect(source).toContain('do not constitute legal advice');
  });

  it('S15-S17: Tavily domain filtering', () => {
    expect(source).toContain('S15-S17: Tavily');
    expect(source).toContain('isAllowedDomain');
    expect(source).toContain('ftc.gov');
  });

  it('S18-S20: Edge cases', () => {
    expect(source).toContain('S18-S20: Edge cases');
    expect(source).toContain('federal-only grounding');
    expect(source).toContain('empty string');
  });
});

/* ================================================================== */
/*  7b: E2E test coverage                                             */
/* ================================================================== */

describe('7b: E2E test files exist', () => {
  it('landing page spec exists', () => {
    expect(rootExists('e2e/landing.spec.ts')).toBe(true);
  });

  it('deposit flow spec exists', () => {
    expect(rootExists('e2e/deposit-flow.spec.ts')).toBe(true);
  });

  it('subscription flow spec exists', () => {
    expect(rootExists('e2e/subscription-flow.spec.ts')).toBe(true);
  });

  it('compliance spec exists', () => {
    expect(rootExists('e2e/compliance.spec.ts')).toBe(true);
  });

  it('API health spec exists', () => {
    expect(rootExists('e2e/api-health.spec.ts')).toBe(true);
  });
});

describe('7b: Deposit flow E2E coverage', () => {
  const source = readRoot('e2e/deposit-flow.spec.ts');

  it('tests deposit landing page with state cards', () => {
    expect(source).toContain('deposit landing page');
    expect(source).toContain('California');
    expect(source).toContain('Texas');
  });

  it('tests per-state pages (CA, TX, NY, FL)', () => {
    expect(source).toContain('/deposit/california');
    expect(source).toContain('/deposit/texas');
    expect(source).toContain('/deposit/new-york');
    expect(source).toContain('/deposit/florida');
  });

  it('tests disclaimer presence', () => {
    expect(source).toContain('writing assistance tool');
  });

  it('tests structured data', () => {
    expect(source).toContain('application/ld+json');
    expect(source).toContain('schema.org');
  });

  it('tests CTA link to registration', () => {
    expect(source).toContain('/register');
  });
});

describe('7b: Subscription flow E2E coverage', () => {
  const source = readRoot('e2e/subscription-flow.spec.ts');

  it('tests subscription landing page', () => {
    expect(source).toContain('/subscription');
  });

  it('tests covered verticals', () => {
    expect(source).toContain('Gym');
    expect(source).toContain('Telecom');
    expect(source).toContain('SaaS');
  });

  it('tests legal basis (ROSCA, FCBA)', () => {
    expect(source).toContain('ROSCA');
    expect(source).toContain('FCBA');
  });
});

describe('7b: Compliance E2E coverage', () => {
  const source = readRoot('e2e/compliance.spec.ts');

  it('tests about page UPL compliance', () => {
    expect(source).toContain('About Page');
    expect(source).toContain('writing assistance');
    expect(source).toContain('not a law firm');
    expect(source).toContain('guarantee');
  });

  it('tests cookie consent', () => {
    expect(source).toContain('Cookie Consent');
  });
});

describe('7b: API health E2E coverage', () => {
  const source = readRoot('e2e/api-health.spec.ts');

  it('tests health endpoint', () => {
    expect(source).toContain('/api/health');
    expect(source).toContain("'ok'");
  });

  it('tests trust stats endpoint', () => {
    expect(source).toContain('/api/trust/stats');
    expect(source).toContain('min_threshold');
  });

  it('tests auth-gated endpoints return 401', () => {
    expect(source).toContain('401');
    expect(source).toContain('/api/account/export');
    expect(source).toContain('/api/account/delete');
    expect(source).toContain('/api/account/subscription');
  });
});

describe('7b: Playwright config', () => {
  const source = readRoot('playwright.config.ts');

  it('playwright config exists', () => {
    expect(rootExists('playwright.config.ts')).toBe(true);
  });

  it('test directory is e2e/', () => {
    expect(source).toContain('./e2e');
  });

  it('has retry on failure', () => {
    expect(source).toContain('retries');
  });

  it('uses Chrome desktop', () => {
    expect(source).toContain('chromium');
  });

  it('captures screenshots on failure', () => {
    expect(source).toContain('screenshot');
  });
});

/* ================================================================== */
/*  7c: KB validation script                                          */
/* ================================================================== */

describe('7c: KB validation script', () => {
  const source = readRoot('scripts/validate-kb.ts');

  it('script exists', () => {
    expect(rootExists('scripts/validate-kb.ts')).toBe(true);
  });

  it('validates statutes array non-empty', () => {
    expect(source).toContain('statutes array is missing or empty');
  });

  it('validates deadline_rules array non-empty', () => {
    expect(source).toContain('deadline_rules array is missing or empty');
  });

  it('checks verification.last_verified', () => {
    expect(source).toContain('verification.last_verified is missing');
  });

  it('checks verification.verified_by', () => {
    expect(source).toContain('verification.verified_by is missing');
  });

  it('has staleness check (> 365 days = error)', () => {
    expect(source).toContain('diffDays > 365');
  });

  it('has staleness warning (> 180 days)', () => {
    expect(source).toContain('diffDays > 180');
  });

  it('cross-references statute_ids in deadline_rules', () => {
    expect(source).toContain(
      'deadline_rules references statute_id',
    );
  });

  it('validates diagnostic graphs', () => {
    expect(source).toContain('validateDiagnosticGraph');
  });

  it('checks graph reachability (BFS)', () => {
    expect(source).toContain('bfsQueue');
    expect(source).toContain('not reachable from entry node');
  });

  it('checks for cycles (DFS)', () => {
    expect(source).toContain('cycle detected');
    expect(source).toContain('WHITE');
    expect(source).toContain('GRAY');
    expect(source).toContain('BLACK');
  });

  it('validates decline-copy coverage', () => {
    expect(source).toContain('validateDeclineCopyCoverage');
    expect(source).toContain('tangled-case-rules.json');
    expect(source).toContain('decline-copy.json');
  });

  it('exits with code 1 on errors, 0 on success', () => {
    expect(source).toContain('process.exit(1)');
    expect(source).toContain('process.exit(0)');
  });
});

describe('7c: KB entries are valid', () => {
  const kbDir = path.resolve(__dirname, '../../kb');

  const kbEntries = [
    'deposit/CA/kb-entry.json',
    'deposit/TX/kb-entry.json',
    'deposit/NY/kb-entry.json',
    'deposit/FL/kb-entry.json',
    'subscription/federal/kb-entry.json',
    'subscription/CA/kb-entry.json',
    'subscription/NY/kb-entry.json',
  ];

  for (const entry of kbEntries) {
    it(`${entry} exists`, () => {
      expect(fs.existsSync(path.join(kbDir, entry))).toBe(true);
    });

    it(`${entry} has verification.last_verified`, () => {
      const data = JSON.parse(
        fs.readFileSync(path.join(kbDir, entry), 'utf-8'),
      ) as { verification?: { last_verified?: string } };
      expect(data.verification?.last_verified).toBeDefined();
      expect(data.verification!.last_verified!.length).toBeGreaterThan(0);
    });

    it(`${entry} has verification.verified_by`, () => {
      const data = JSON.parse(
        fs.readFileSync(path.join(kbDir, entry), 'utf-8'),
      ) as { verification?: { verified_by?: string } };
      expect(data.verification?.verified_by).toBeDefined();
      expect(data.verification!.verified_by!.length).toBeGreaterThan(0);
    });

    it(`${entry} has non-empty statutes`, () => {
      const data = JSON.parse(
        fs.readFileSync(path.join(kbDir, entry), 'utf-8'),
      ) as { statutes?: unknown[] };
      expect(Array.isArray(data.statutes)).toBe(true);
      expect(data.statutes!.length).toBeGreaterThan(0);
    });
  }
});

/* ================================================================== */
/*  7d: Load test script structure                                    */
/* ================================================================== */

describe('7d: Load test script', () => {
  const source = readRoot('scripts/load-test.ts');

  it('script exists', () => {
    expect(rootExists('scripts/load-test.ts')).toBe(true);
  });

  it('defaults to 500 concurrent requests', () => {
    expect(source).toMatch(/CONCURRENT\s*=\s*500/);
  });

  it('runs 3 rounds', () => {
    expect(source).toMatch(/ROUNDS\s*=\s*3/);
  });

  it('tests health endpoint', () => {
    expect(source).toContain('/api/health');
  });

  it('tests landing page', () => {
    expect(source).toContain('Landing page');
  });

  it('reports P50, P95, P99 percentiles', () => {
    expect(source).toContain('P50');
    expect(source).toContain('P95');
    expect(source).toContain('P99');
  });

  it('reports error rate', () => {
    expect(source).toContain('Error rate');
  });

  it('flags error rate > 5%', () => {
    expect(source).toContain('ERROR RATE EXCEEDS 5%');
    expect(source).toContain('0.05');
  });

  it('reads APP_URL from environment', () => {
    expect(source).toContain('process.env.APP_URL');
  });

  it('is registered in package.json as test:load', () => {
    const pkg = JSON.parse(readRoot('package.json')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['test:load']).toBeDefined();
    expect(pkg.scripts['test:load']).toContain('load-test');
  });
});

/* ================================================================== */
/*  7e: About page UPL compliance                                     */
/* ================================================================== */

describe('7e: About page UPL compliance', () => {
  const source = readSource('app/about/page.tsx');

  it('uses "writing assistance tool" framing', () => {
    expect(source).toContain('writing assistance tool');
  });

  it('states "not a law firm"', () => {
    expect(source).toContain('not a law firm');
  });

  it('states "do not provide legal advice"', () => {
    expect(source).toContain('do not provide legal advice');
  });

  it('states "does not guarantee any outcome"', () => {
    expect(source).toContain('guarantee any outcome');
  });

  it('mentions "licensed attorney"', () => {
    expect(source).toContain('licensed attorney');
  });

  it('does not claim to be a lawyer or law firm', () => {
    const lowerSource = source.toLowerCase();
    expect(lowerSource).not.toContain('we are lawyers');
    expect(lowerSource).not.toContain('our attorneys');
    expect(lowerSource).not.toContain('our lawyers');
  });

  it('does not promise specific outcomes', () => {
    const lowerSource = source.toLowerCase();
    expect(lowerSource).not.toContain('will recover');
    expect(lowerSource).not.toContain('will win');
    expect(lowerSource).not.toContain('guaranteed recovery');
  });

  it('describes the generation process honestly', () => {
    expect(source).toContain('grounding context');
    expect(source).toContain('citation');
    // "Compliance scanning" — the about page uses capitalized version
    expect(source.toLowerCase()).toContain('compliance');
  });

  it('mentions proper coverage areas', () => {
    expect(source).toContain('California');
    expect(source).toContain('Texas');
    expect(source).toContain('New York');
    expect(source).toContain('Florida');
  });
});

describe('7e: Compliance disclaimers KB', () => {
  const kbDir = path.resolve(__dirname, '../../kb');
  const disclaimersPath = path.join(kbDir, 'compliance', 'disclaimers.json');

  it('disclaimers.json exists', () => {
    expect(fs.existsSync(disclaimersPath)).toBe(true);
  });

  it('has marketing_landing disclaimer', () => {
    const data = JSON.parse(
      fs.readFileSync(disclaimersPath, 'utf-8'),
    ) as { disclaimers: Record<string, { id: string } | undefined> };
    const marketing = data.disclaimers['marketing_landing'];
    expect(marketing).toBeDefined();
    expect(marketing!.id).toBe('disclaimer-marketing');
  });

  it('has pre_generation_acknowledgment disclaimer', () => {
    const data = JSON.parse(
      fs.readFileSync(disclaimersPath, 'utf-8'),
    ) as { disclaimers: Record<string, { required?: boolean } | undefined> };
    const preGen = data.disclaimers['pre_generation_acknowledgment'];
    expect(preGen).toBeDefined();
    expect(preGen!.required).toBe(true);
  });

  it('has at least 8 disclaimer variants', () => {
    const data = JSON.parse(
      fs.readFileSync(disclaimersPath, 'utf-8'),
    ) as { disclaimers: Record<string, unknown> };
    expect(Object.keys(data.disclaimers).length).toBeGreaterThanOrEqual(8);
  });
});

/* ================================================================== */
/*  7f: SEO landing pages                                             */
/* ================================================================== */

describe('7f: Deposit landing page', () => {
  it('deposit landing page exists', () => {
    expect(
      fileExists('app/(marketing)/deposit/page.tsx'),
    ).toBe(true);
  });

  const source = readSource('app/(marketing)/deposit/page.tsx');

  it('has proper H1', () => {
    expect(source).toContain('<h1');
    expect(source).toContain('Security Deposit');
  });

  it('exports metadata with title and description', () => {
    expect(source).toContain('export const metadata');
    expect(source).toContain('Security Deposit Recovery');
  });

  it('has OpenGraph metadata', () => {
    expect(source).toContain('openGraph');
  });

  it('lists all 4 states with links', () => {
    expect(source).toContain('california');
    expect(source).toContain('texas');
    expect(source).toContain('new-york');
    expect(source).toContain('florida');
  });

  it('has CTA to registration', () => {
    // Value-first funnel (M3): the CTA starts the anonymous diagnostic at /start?wedge=deposit
    // (the registration/auth step happens inside that flow) instead of linking to
    // /register directly. Same intent: a CTA that starts the user's letter journey.
    expect(source).toContain('/start?wedge=deposit');
    expect(source).toContain('Start Your Letter');
  });

  it('includes marketing disclaimer footer', () => {
    expect(source).toContain('writing assistance tool');
    expect(source).toContain('does not provide legal');
  });
});

describe('7f: Per-state deposit pages', () => {
  const states = [
    {
      slug: 'california',
      statute: 'Cal. Civ. Code §1950.5',
      deadline: '21 calendar days',
    },
    {
      slug: 'texas',
      statute: 'Tex. Prop. Code §92.103',
      deadline: '30 days',
    },
    {
      slug: 'new-york',
      statute: 'N.Y. Gen. Oblig. Law §7-108',
      deadline: '14 days',
    },
    {
      slug: 'florida',
      statute: 'Fla. Stat. §83.49',
      deadline: '15 days',
    },
  ];

  for (const state of states) {
    it(`${state.slug} page exists`, () => {
      expect(
        fileExists(`app/(marketing)/deposit/${state.slug}/page.tsx`),
      ).toBe(true);
    });

    it(`${state.slug} page has correct metadata`, () => {
      const source = readSource(
        `app/(marketing)/deposit/${state.slug}/page.tsx`,
      );
      expect(source).toContain('export const metadata');
      expect(source).toContain(state.statute);
    });

    it(`${state.slug} page passes statute to DepositStatePage`, () => {
      const source = readSource(
        `app/(marketing)/deposit/${state.slug}/page.tsx`,
      );
      expect(source).toContain('DepositStatePage');
      expect(source).toContain(`primaryStatute="${state.statute}"`);
    });
  }
});

describe('7f: DepositStatePage shared component', () => {
  it('component exists', () => {
    expect(fileExists('features/seo/deposit-state-page.tsx')).toBe(true);
  });

  const source = readSource('features/seo/deposit-state-page.tsx');

  it('has proper H1 with state name', () => {
    expect(source).toContain('<h1');
    expect(source).toContain('{stateName}');
    expect(source).toContain('Security Deposit Recovery');
  });

  it('shows primary statute, return deadline, and penalty', () => {
    expect(source).toContain('{primaryStatute}');
    expect(source).toContain('{returnDeadline}');
    expect(source).toContain('{penaltyNote}');
  });

  it('includes JSON-LD structured data', () => {
    // SEO refactor: inline JSON-LD replaced by builder functions from
    // '@/lib/seo/schema' (organizationSchema/depositServiceSchema/breadcrumbSchema),
    // rendered into application/ld+json script tags. The schema.org/@type/Service
    // strings now live in the builder module (single source of truth).
    expect(source).toContain('application/ld+json');
    expect(source).toContain('depositServiceSchema');
    expect(source).toContain("from '@/lib/seo/schema'");
    const schemaModule = fs.readFileSync(
      path.resolve(__dirname, '../lib/seo/schema.ts'),
      'utf-8',
    );
    expect(schemaModule).toContain('schema.org');
    expect(schemaModule).toContain('@type');
    expect(schemaModule).toContain("'Service'");
  });

  it('structured data includes service type "Writing Assistance"', () => {
    // SEO refactor: the deposit Service schema's serviceType now lives in the
    // depositServiceSchema() builder. Its value was reworded to
    // 'Legal document writing assistance' (still a writing-assistance service type).
    const schemaModule = fs.readFileSync(
      path.resolve(__dirname, '../lib/seo/schema.ts'),
      'utf-8',
    );
    expect(schemaModule).toContain("serviceType: 'Legal document writing assistance'");
  });

  it('includes marketing disclaimer footer', () => {
    expect(source).toContain('writing assistance tool');
    expect(source).toContain('does not provide legal');
    expect(source).toContain('does not guarantee outcomes');
  });

  it('has CTA to registration', () => {
    // Value-first funnel (M3): the CTA starts the anonymous diagnostic at /start?wedge=deposit
    // (registration happens within that flow) rather than linking to /register.
    expect(source).toContain('/start?wedge=deposit');
  });

  it('has 4-step "how to recover" process', () => {
    expect(source).toContain('Answer diagnostic questions');
    expect(source).toContain('Receive a demand letter');
    expect(source).toContain('Review and send');
    expect(source).toContain('escalation documents');
  });
});

describe('7f: Subscription landing page', () => {
  it('subscription landing page exists', () => {
    expect(
      fileExists('app/(marketing)/subscription/page.tsx'),
    ).toBe(true);
  });

  const source = readSource('app/(marketing)/subscription/page.tsx');

  it('has proper H1', () => {
    expect(source).toContain('<h1');
    expect(source).toContain('Cancel');
    expect(source).toContain('Subscription');
  });

  it('exports metadata with title and description', () => {
    expect(source).toContain('export const metadata');
    expect(source).toContain('Subscription Cancellation');
  });

  it('lists covered verticals', () => {
    expect(source).toContain('Gym Memberships');
    expect(source).toContain('Telecom');
    expect(source).toContain('SaaS');
    expect(source).toContain('Streaming');
  });

  it('explains legal basis (ROSCA, FCBA)', () => {
    expect(source).toContain('ROSCA');
    expect(source).toContain('FCBA');
    expect(source).toContain('Fair Credit Billing Act');
  });

  it('mentions free for all US states', () => {
    expect(source).toContain('Free');
    expect(source).toContain('all US states');
  });

  it('includes JSON-LD structured data', () => {
    expect(source).toContain('application/ld+json');
    expect(source).toContain('Subscription Cancellation');
  });

  it('includes marketing disclaimer footer', () => {
    expect(source).toContain('writing assistance tool');
    expect(source).toContain('does not provide legal');
  });
});

/* ================================================================== */
/*  Scripts registered in package.json                                */
/* ================================================================== */

describe('Build scripts in package.json', () => {
  const pkg = JSON.parse(readRoot('package.json')) as {
    scripts: Record<string, string>;
  };

  it('test command exists', () => {
    expect(pkg.scripts['test']).toBe('vitest run');
  });

  it('test:e2e command exists', () => {
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
  });

  it('test:load command exists', () => {
    expect(pkg.scripts['test:load']).toContain('load-test');
  });

  it('validate-kb command exists', () => {
    expect(pkg.scripts['validate-kb']).toContain('validate-kb');
  });

  it('scan-phrases command exists', () => {
    expect(pkg.scripts['scan-phrases']).toContain(
      'scan-prohibited-phrases',
    );
  });

  it('validate-claims command exists', () => {
    expect(pkg.scripts['validate-claims']).toContain('validate-claims');
  });

  it('compliance-check combines scan-phrases and validate-claims', () => {
    expect(pkg.scripts['compliance-check']).toContain('scan-phrases');
    expect(pkg.scripts['compliance-check']).toContain('validate-claims');
  });
});

/* ================================================================== */
/*  Risk mitigation                                                   */
/* ================================================================== */

describe('Risk: Regression tests handle async generation', () => {
  const generateSource = readSource(
    'app/api/cases/[id]/generate/route.ts',
  );

  it('generate route has both sync and async paths', () => {
    // Sync path: calls handleDepositGeneration / handleSubscriptionGeneration directly
    expect(generateSource).toContain('handleDepositGeneration');
    expect(generateSource).toContain('handleSubscriptionGeneration');
    // Async path: enqueueLetterGeneration when circuit breaker fires
    expect(generateSource).toContain('enqueueLetterGeneration');
  });

  it('circuit breaker threshold documented', () => {
    expect(generateSource).toContain('CIRCUIT_BREAKER_THRESHOLD');
  });
});

describe('Risk: KB validation detects stale entries', () => {
  const source = readRoot('scripts/validate-kb.ts');

  it('checks for entries > 365 days old (error)', () => {
    expect(source).toContain('365');
    expect(source).toContain('error');
  });

  it('checks for entries > 180 days old (warning)', () => {
    expect(source).toContain('180');
    expect(source).toContain('warn');
  });
});

describe('Risk: E2E tests avoid Paddle dependency', () => {
  // Verify E2E tests don't require real Paddle integration
  const depositSpec = readRoot('e2e/deposit-flow.spec.ts');
  const subscriptionSpec = readRoot('e2e/subscription-flow.spec.ts');

  it('deposit E2E tests do not call Paddle checkout', () => {
    // Comments may mention Paddle for context, but test code should not call it
    const codeOnly = depositSpec.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly.toLowerCase()).not.toContain('paddle');
  });

  it('subscription E2E tests do not call Paddle checkout', () => {
    const codeOnly = subscriptionSpec.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly.toLowerCase()).not.toContain('paddle');
  });
});

describe('Risk: SEO pages have mandatory disclaimers', () => {
  const depositPage = readSource('app/(marketing)/deposit/page.tsx');
  const subscriptionPage = readSource(
    'app/(marketing)/subscription/page.tsx',
  );
  const statePage = readSource('features/seo/deposit-state-page.tsx');

  it('deposit landing has disclaimer', () => {
    expect(depositPage).toContain('does not provide legal');
    expect(depositPage).toContain('does not guarantee');
  });

  it('subscription landing has disclaimer', () => {
    expect(subscriptionPage).toContain('does not provide legal');
    expect(subscriptionPage).toContain('does not guarantee');
  });

  it('state page component has disclaimer', () => {
    expect(statePage).toContain('does not provide legal');
    expect(statePage).toContain('does not guarantee');
  });
});
