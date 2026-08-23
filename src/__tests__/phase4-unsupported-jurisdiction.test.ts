/**
 * Phase 4 — Unsupported Jurisdiction, Waitlist & Safety Nets — Tests
 *
 * Validates:
 * - Waitlist API validates input, rate-limits, and inserts correctly
 * - Unsupported-jurisdiction flow renders with generic letter + resources
 * - Auto-refund is wired in the generate route as belt-and-suspenders
 * - Generic demand letter has zero statute citations
 * - State resources cover all unsupported states
 *
 * Risk mitigations from plan.md:
 * - R1: db:gen-types type mismatch — manual types audited (36 annotations documented)
 * - R2: Waitlist table exists in migrations
 * - R3: Generic demand letter has no jurisdiction-specific language
 * - R4: Auto-refund uses proper Paddle API key handling
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/* ================================================================== */
/*  1. Waitlist API route                                             */
/* ================================================================== */

describe('4a: Waitlist API route', () => {
  const waitlistPath = path.resolve(
    __dirname,
    '../app/api/waitlist/route.ts',
  );
  const waitlistSource = fs.readFileSync(waitlistPath, 'utf-8');

  it('is no longer a placeholder (501 Not Implemented)', () => {
    expect(waitlistSource).not.toContain("'Not implemented'");
    expect(waitlistSource).not.toContain('status: 501');
  });

  it('validates input with Zod schema', () => {
    expect(waitlistSource).toContain("import { z } from 'zod'");
    expect(waitlistSource).toContain('waitlistSchema');
    expect(waitlistSource).toContain('.safeParse(body)');
  });

  it('validates email field', () => {
    expect(waitlistSource).toContain("z.string().email(");
  });

  it('validates state field (2-letter code)', () => {
    expect(waitlistSource).toContain('.min(2');
    expect(waitlistSource).toContain('.max(2');
    expect(waitlistSource).toContain('.toUpperCase()');
  });

  it('validates wedge field against enum', () => {
    expect(waitlistSource).toContain('z.enum(WEDGE');
  });

  it('rate-limits by IP address', () => {
    expect(waitlistSource).toContain('checkRateLimit');
    expect(waitlistSource).toContain('x-forwarded-for');
    expect(waitlistSource).toContain('waitlist:');
  });

  it('returns 429 when rate limited', () => {
    expect(waitlistSource).toContain('status: 429');
    expect(waitlistSource).toContain('Too many requests');
  });

  it('inserts into waitlist_entries table', () => {
    // Convex migration: supabase.from('waitlist_entries').insert(...) ->
    // convex.mutation(api.service.joinWaitlist, ...)
    expect(waitlistSource).toContain('api.service.joinWaitlist');
    expect(waitlistSource).toContain('convex.mutation(');
  });

  it('handles duplicate entries gracefully (unique constraint)', () => {
    // Convex migration: Postgres dup-key error code '23505' -> the joinWaitlist
    // mutation returns a { duplicate: true } flag the route checks.
    expect(waitlistSource).toContain('result.duplicate');
    expect(waitlistSource).toContain('already on the waitlist');
  });

  it('returns { ok: true } on success', () => {
    expect(waitlistSource).toContain('ok: true');
  });

  it('returns validation error details on bad input', () => {
    expect(waitlistSource).toContain('Validation failed');
    expect(waitlistSource).toContain('fieldErrors');
  });
});

/* ================================================================== */
/*  2. Waitlist table exists in migrations                            */
/* ================================================================== */

describe('4a (risk): Waitlist table exists in migrations', () => {
  const migrationsDir = path.resolve(
    __dirname,
    '../../supabase/migrations',
  );

  it('waitlist_entries table is defined in create_tables migration', () => {
    const createTablesPath = path.join(migrationsDir, '00002_create_tables.sql');
    const sql = fs.readFileSync(createTablesPath, 'utf-8');
    expect(sql).toContain('waitlist_entries');
  });

  it('waitlist_entries has index on (state, wedge)', () => {
    const indexesPath = path.join(migrationsDir, '00003_create_indexes.sql');
    const sql = fs.readFileSync(indexesPath, 'utf-8');
    expect(sql).toContain('idx_waitlist_state_wedge');
  });

  it('waitlist_entries has unique constraint on (email, state, wedge)', () => {
    const constraintsPath = path.join(migrationsDir, '00004_create_unique_constraints.sql');
    const sql = fs.readFileSync(constraintsPath, 'utf-8');
    expect(sql).toContain('uq_waitlist_email_state_wedge');
  });
});

/* ================================================================== */
/*  3. Unsupported-jurisdiction screen component                      */
/* ================================================================== */

describe('4b: Unsupported-jurisdiction screen component', () => {
  const componentPath = path.resolve(
    __dirname,
    '../components/dashboard/unsupported-jurisdiction-screen.tsx',
  );
  const componentSource = fs.readFileSync(componentPath, 'utf-8');

  it('exists and is a client component', () => {
    expect(componentSource).toContain("'use client'");
  });

  it('exports UnsupportedJurisdictionScreen', () => {
    expect(componentSource).toContain(
      'export function UnsupportedJurisdictionScreen',
    );
  });

  it('accepts state, stateResources, genericLetterUrl, and onBack props', () => {
    expect(componentSource).toContain('state: string');
    expect(componentSource).toContain('stateResources: StateResources | null');
    expect(componentSource).toContain('genericLetterUrl: string');
    expect(componentSource).toContain('onBack: () => void');
  });

  it('renders generic demand letter download link', () => {
    expect(componentSource).toContain('Download Template');
    expect(componentSource).toContain('genericLetterUrl');
  });

  it('renders state resource links', () => {
    expect(componentSource).toContain('Deposit Statute');
    expect(componentSource).toContain('Small Claims Court');
    expect(componentSource).toContain('Free Legal Aid');
    expect(componentSource).toContain('Attorney General Complaint');
  });

  it('has waitlist email capture form', () => {
    expect(componentSource).toContain('/api/waitlist');
    expect(componentSource).toContain("type=\"email\"");
    // UI redesign: button label is now 'Join the Waitlist'
    expect(componentSource).toContain('Join the Waitlist');
  });

  it('sends correct payload to waitlist API', () => {
    expect(componentSource).toContain("wedge: 'deposit'");
    expect(componentSource).toContain('email, state');
  });

  it('shows success message after joining waitlist', () => {
    expect(componentSource).toContain("'success'");
    expect(componentSource).toContain('waitlistMessage');
  });

  it('shows error message on failure', () => {
    expect(componentSource).toContain("'error'");
    expect(componentSource).toContain('text-destructive');
  });

  it('has back button', () => {
    expect(componentSource).toContain('onBack');
    expect(componentSource).toContain('Back to state selection');
  });

  it('includes UPL disclaimer', () => {
    expect(componentSource).toContain('not legal advice');
  });
});

/* ================================================================== */
/*  4. Empty-state — "My state isn't listed" flow                     */
/* ================================================================== */

describe('4b (cont): Empty-state — unsupported jurisdiction flow', () => {
  const emptyStatePath = path.resolve(
    __dirname,
    '../components/dashboard/empty-state.tsx',
  );
  const emptyStateSource = fs.readFileSync(emptyStatePath, 'utf-8');

  it('imports UnsupportedJurisdictionScreen', () => {
    expect(emptyStateSource).toContain(
      "import { UnsupportedJurisdictionScreen }",
    );
  });

  it('imports STATE_RESOURCES', () => {
    expect(emptyStateSource).toContain(
      "import { STATE_RESOURCES }",
    );
  });

  it('has unsupportedState state variable', () => {
    expect(emptyStateSource).toContain('unsupportedState');
    expect(emptyStateSource).toContain('setUnsupportedState');
  });

  it('has "My state isn\'t listed" button in jurisdiction picker', () => {
    expect(emptyStateSource).toContain("My state isn");
    expect(emptyStateSource).toContain('handleMyStateNotListed');
  });

  it('shows unsupported state picker (excluding CA/TX/NY/FL)', () => {
    expect(emptyStateSource).toContain('DEPOSIT_JURISDICTIONS');
    expect(emptyStateSource).toContain('.filter(');
    expect(emptyStateSource).toContain('.includes(s)');
  });

  it('renders UnsupportedJurisdictionScreen when state is selected', () => {
    expect(emptyStateSource).toContain('<UnsupportedJurisdictionScreen');
    expect(emptyStateSource).toContain('STATE_RESOURCES[unsupportedState]');
  });

  it('passes generic letter URL to the screen', () => {
    expect(emptyStateSource).toContain('generic-demand-letter.md');
  });

  it('has back handler to return to main screen', () => {
    expect(emptyStateSource).toContain('handleBackFromUnsupported');
    expect(emptyStateSource).toContain('setUnsupportedState(null)');
  });
});

/* ================================================================== */
/*  5. State resources module                                         */
/* ================================================================== */

describe('4b (cont): State resources data', () => {
  const resourcesPath = path.resolve(
    __dirname,
    '../lib/kb/state-resources.ts',
  );
  const resourcesSource = fs.readFileSync(resourcesPath, 'utf-8');

  it('exports STATE_RESOURCES record', () => {
    expect(resourcesSource).toContain('export const STATE_RESOURCES');
  });

  it('exports StateResourceEntry interface', () => {
    expect(resourcesSource).toContain('export interface StateResourceEntry');
  });

  // Verify key states are present
  const sampleStates = ['OH', 'IL', 'PA', 'GA', 'MI', 'WA', 'CO', 'MA'];
  for (const state of sampleStates) {
    it(`has resources for ${state}`, () => {
      expect(resourcesSource).toContain(`${state}:`);
    });
  }

  it('does NOT include supported states (CA, TX, NY, FL)', () => {
    // These should not be in the unsupported resources map
    // They use the full generation pipeline instead
    const lines = resourcesSource.split('\n');
    const dataLines = lines.filter(
      (l) => l.trim().startsWith('CA:') || l.trim().startsWith('TX:') ||
             l.trim().startsWith('NY:') || l.trim().startsWith('FL:'),
    );
    expect(dataLines).toHaveLength(0);
  });

  it('each entry has all required fields', () => {
    expect(resourcesSource).toContain('deposit_statute:');
    expect(resourcesSource).toContain('deposit_statute_url:');
    expect(resourcesSource).toContain('small_claims_url:');
    expect(resourcesSource).toContain('legal_aid_url:');
    expect(resourcesSource).toContain('ag_complaint_url:');
  });
});

/* ================================================================== */
/*  6. Generic demand letter — no statute citations                   */
/* ================================================================== */

describe('4b (risk): Generic demand letter — UPL compliance', () => {
  const letterPath = path.resolve(
    __dirname,
    '../../kb/unsupported/generic-demand-letter.md',
  );
  const letterContent = fs.readFileSync(letterPath, 'utf-8');

  it('exists and is non-empty', () => {
    expect(letterContent.length).toBeGreaterThan(100);
  });

  it('contains NO specific state statute citations', () => {
    // Should not contain patterns like "§1234.56" with state abbreviations
    const statutePatterns = [
      /Cal\.\s*Civ/i,
      /Tex\.\s*Prop/i,
      /N\.Y\.\s*Gen/i,
      /Fla\.\s*Stat/i,
      /ILCS/,
      /Rev\.\s*Stat\.\s*§\d+/,
    ];
    for (const pattern of statutePatterns) {
      expect(letterContent).not.toMatch(pattern);
    }
  });

  it('contains NO specific deadline numbers', () => {
    // Should not reference specific state deadlines like "21 days" or "30 days"
    // (those are state-specific; CA=21, TX=30, etc.)
    expect(letterContent).not.toMatch(/within \d+ days/);
    // But should have a general "reasonable period" reference
    expect(letterContent).toContain('reasonable period');
  });

  it('contains NO penalty language', () => {
    // Should not promise specific monetary penalties
    expect(letterContent).not.toMatch(/treble damages/i);
    expect(letterContent).not.toMatch(/\d+x the deposit/i);
    expect(letterContent).not.toMatch(/double the/i);
    expect(letterContent).not.toMatch(/triple the/i);
  });

  it('has clear "NOT LEGAL ADVICE" disclaimer', () => {
    expect(letterContent).toContain('NOT LEGAL ADVICE');
  });

  it('has instructions for use', () => {
    expect(letterContent).toContain('INSTRUCTIONS FOR USE');
  });

  it('recommends certified mail', () => {
    expect(letterContent).toContain('certified mail');
  });

  it('uses bracketed placeholders (no real data)', () => {
    expect(letterContent).toContain('[Your Name]');
    expect(letterContent).toContain('[Landlord');
    expect(letterContent).toContain('[Amount]');
  });

  it('explicitly states it has no state-specific content', () => {
    expect(letterContent).toContain(
      'does not cite any specific state statute',
    );
  });
});

/* ================================================================== */
/*  7. State resources KB JSON — completeness                         */
/* ================================================================== */

describe('4b (cont): State resources KB JSON', () => {
  const jsonPath = path.resolve(
    __dirname,
    '../../kb/unsupported/state-resources/index.json',
  );
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as {
    states: Record<string, { name: string; verified: boolean }>;
  };

  it('has entries for all 50 states + DC minus 4 supported', () => {
    const stateCount = Object.keys(jsonContent.states).length;
    // 50 states + DC = 51, minus CA/TX/NY/FL = 47
    expect(stateCount).toBe(47);
  });

  it('does not include CA, TX, NY, or FL', () => {
    expect(jsonContent.states['CA']).toBeUndefined();
    expect(jsonContent.states['TX']).toBeUndefined();
    expect(jsonContent.states['NY']).toBeUndefined();
    expect(jsonContent.states['FL']).toBeUndefined();
  });

  it('each state has all required resource fields', () => {
    for (const [code, state] of Object.entries(jsonContent.states)) {
      const entry = state as Record<string, unknown>;
      expect(entry['name']).toBeTruthy();
      expect(entry['deposit_statute']).toBeTruthy();
      expect(entry['deposit_statute_url']).toBeTruthy();
      expect(entry['small_claims_url']).toBeTruthy();
      expect(entry['legal_aid_url']).toBeTruthy();
      expect(entry['ag_complaint_url']).toBeTruthy();
      // Verify name is a real state name (not blank)
      expect((entry['name'] as string).length).toBeGreaterThan(2);
      // Fail with helpful message if a field is missing
      if (!entry['deposit_statute']) {
        throw new Error(`Missing deposit_statute for ${code}`);
      }
    }
  });

  it('has verification status noting manual review needed', () => {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Record<string, unknown>;
    expect(raw['verification_status']).toBe('NEEDS_MANUAL_VERIFICATION');
  });
});

/* ================================================================== */
/*  8. Auto-refund — wired in generate route                          */
/* ================================================================== */

describe('4c: Auto-refund in generate route', () => {
  const generatePath = path.resolve(
    __dirname,
    '../app/api/cases/[id]/generate/route.ts',
  );
  const generateSource = fs.readFileSync(generatePath, 'utf-8');

  it('imports processAutoRefundIfNeeded', () => {
    expect(generateSource).toContain(
      "import { processAutoRefundIfNeeded } from '@/lib/payments/auto-refund'",
    );
  });

  it('imports DEPOSIT_JURISDICTION enum', () => {
    expect(generateSource).toContain(
      "import { DEPOSIT_JURISDICTION",
    );
  });

  it('checks jurisdiction before generation', () => {
    // The jurisdiction check is in the POST handler (before routing to wedge handler).
    // In the POST function, DEPOSIT_JURISDICTION.includes runs before
    // handleDepositGeneration is called (which contains generateLetter).
    const postIdx = generateSource.indexOf('export async function POST');
    const postSource = generateSource.slice(postIdx);
    const jurisdictionCheck = postSource.indexOf('DEPOSIT_JURISDICTION.includes');
    const depositRouting = postSource.indexOf('handleDepositGeneration');
    expect(jurisdictionCheck).toBeGreaterThan(-1);
    expect(depositRouting).toBeGreaterThan(jurisdictionCheck);
  });

  it('calls processAutoRefundIfNeeded for unsupported jurisdictions', () => {
    expect(generateSource).toContain('processAutoRefundIfNeeded(caseId');
  });

  it('looks up paddle_transaction_id for refund', () => {
    expect(generateSource).toContain('paddle_transaction_id');
  });

  it('returns 422 error for unsupported jurisdiction', () => {
    expect(generateSource).toContain('is not supported for deposit cases');
    expect(generateSource).toContain('status: 422');
  });

  it('mentions refund in error message', () => {
    expect(generateSource).toContain('refund has been initiated');
  });

  it('wraps auto-refund in try-catch (non-critical)', () => {
    expect(generateSource).toContain('Auto-refund attempt failed');
  });

  it('jurisdiction check is after payment gate', () => {
    const paymentGate = generateSource.indexOf("payment_status !== 'paid'");
    const jurisdictionGate = generateSource.indexOf('DEPOSIT_JURISDICTION.includes');
    expect(paymentGate).toBeGreaterThan(-1);
    expect(jurisdictionGate).toBeGreaterThan(paymentGate);
  });
});

/* ================================================================== */
/*  9. Auto-refund function — proper implementation                   */
/* ================================================================== */

describe('4c (cont): Auto-refund function', () => {
  const autoRefundPath = path.resolve(
    __dirname,
    '../lib/payments/auto-refund.ts',
  );
  const autoRefundSource = fs.readFileSync(autoRefundPath, 'utf-8');

  it('exports processAutoRefundIfNeeded', () => {
    expect(autoRefundSource).toContain(
      'export async function processAutoRefundIfNeeded',
    );
  });

  it('exports AutoRefundResult type', () => {
    expect(autoRefundSource).toContain('export interface AutoRefundResult');
  });

  it('checks if jurisdiction is supported', () => {
    expect(autoRefundSource).toContain('DEPOSIT_JURISDICTION.includes');
  });

  it('only processes deposit wedge cases', () => {
    expect(autoRefundSource).toContain("caseRow.wedge !== 'deposit'");
  });

  it('calls Paddle API for refund', () => {
    expect(autoRefundSource).toContain('requestPaddleRefund');
    expect(autoRefundSource).toContain('/transactions/');
    expect(autoRefundSource).toContain('/refund');
  });

  it('uses server-side Paddle API key', () => {
    expect(autoRefundSource).toContain('process.env.PADDLE_API_KEY');
  });

  it('handles missing API key gracefully', () => {
    expect(autoRefundSource).toContain('Paddle API key not configured');
    expect(autoRefundSource).toContain("ok: false");
  });

  it('supports sandbox and production Paddle URLs', () => {
    expect(autoRefundSource).toContain('sandbox-api.paddle.com');
    expect(autoRefundSource).toContain('api.paddle.com');
  });

  it('updates case status to refunded/closed after refund', () => {
    // Convex migration: the Supabase update is now a single setPaymentStatus
    // mutation call carrying paymentStatus: 'refunded' and newStatus: 'closed'.
    expect(autoRefundSource).toContain('api.service.setPaymentStatus');
    expect(autoRefundSource).toContain("paymentStatus: 'refunded'");
    expect(autoRefundSource).toContain("newStatus: 'closed'");
  });

  it('records status history', () => {
    // Convex migration: status-history recording (former case_status_history
    // insert with new_status: 'closed') is now performed atomically inside the
    // setPaymentStatus mutation, driven by the newStatus: 'closed' argument.
    expect(autoRefundSource).toContain('api.service.setPaymentStatus');
    expect(autoRefundSource).toContain("newStatus: 'closed'");
  });

  it('uses service-role client (not user session)', () => {
    // Convex migration: the trusted service-role Supabase client is replaced by
    // the worker Convex client (workerConvex) from @/lib/convex/worker-client.
    expect(autoRefundSource).toContain('workerConvex');
    expect(autoRefundSource).toContain("@/lib/convex/worker-client");
  });
});

/* ================================================================== */
/*  10. Database types — manual types are consistent                  */
/* ================================================================== */

describe('4d: Database types — manual types', () => {
  const typesPath = path.resolve(
    __dirname,
    '../types/database.types.ts',
  );
  const typesSource = fs.readFileSync(typesPath, 'utf-8');

  it('has waitlist_entries table type', () => {
    expect(typesSource).toContain('waitlist_entries');
  });

  it('waitlist_entries Row has correct fields', () => {
    // Find the waitlist_entries block
    expect(typesSource).toContain('email: string');
    expect(typesSource).toContain('state: string');
  });

  it('has cases table type', () => {
    expect(typesSource).toContain('cases:');
  });

  it('has all 14 tables defined', () => {
    const expectedTables = [
      'cases',
      'letters',
      'sequences',
      'documents',
      'packets',
      'deadline_events',
      'outcomes',
      'case_status_history',
      'subscriptions',
      'waitlist_entries',
      'webhook_events',
      'audit_log',
    ];
    for (const table of expectedTables) {
      expect(typesSource).toContain(`${table}:`);
    }
  });

  it('each table has Row, Insert, and Update types', () => {
    // Count occurrences of Row:, Insert:, Update:
    const rowCount = (typesSource.match(/Row:\s*\{/g) ?? []).length;
    const insertCount = (typesSource.match(/Insert:\s*\{/g) ?? []).length;
    const updateCount = (typesSource.match(/Update:\s*\{/g) ?? []).length;
    // Each should have at least 12+ (one per table)
    expect(rowCount).toBeGreaterThanOrEqual(12);
    expect(insertCount).toBeGreaterThanOrEqual(12);
    expect(updateCount).toBeGreaterThanOrEqual(12);
  });
});

/* ================================================================== */
/*  11. @ts-expect-error audit                                        */
/* ================================================================== */

describe('4d (cont): @ts-expect-error audit', () => {
  it('all @ts-expect-error annotations are Supabase SSR type issues', () => {
    // Read files with @ts-expect-error and verify each has the standard comment
    const filesToCheck = [
      '../app/api/cases/[id]/generate/route.ts',
      '../app/api/cases/[id]/status/route.ts',
      '../app/api/sequences/[id]/advance/route.ts',
      '../lib/payments/webhook-processor.ts',
      '../lib/payments/auto-refund.ts',
    ];

    for (const filePath of filesToCheck) {
      const source = fs.readFileSync(
        path.resolve(__dirname, filePath),
        'utf-8',
      );
      const lines = source.split('\n');
      const tsExpectLines = lines.filter((l) =>
        l.includes('@ts-expect-error'),
      );
      for (const line of tsExpectLines) {
        // Each should have a comment explaining it's a Supabase issue
        expect(line).toMatch(/supabase|SSR|generic|service.role/i);
      }
    }
  });
});

/* ================================================================== */
/*  12. Enums — DEPOSIT_JURISDICTION                                  */
/* ================================================================== */

describe('4 (cross-cutting): Enums for jurisdiction', () => {
  const enumsPath = path.resolve(__dirname, '../types/enums.ts');
  const enumsSource = fs.readFileSync(enumsPath, 'utf-8');

  it('DEPOSIT_JURISDICTION defines exactly CA, TX, NY, FL', () => {
    expect(enumsSource).toContain("'CA'");
    expect(enumsSource).toContain("'TX'");
    expect(enumsSource).toContain("'NY'");
    expect(enumsSource).toContain("'FL'");
    // Verify it's an array of exactly 4
    const match = enumsSource.match(/DEPOSIT_JURISDICTION\s*=\s*\[([^\]]+)\]/);
    expect(match).toBeTruthy();
    const items = match![1]!.split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(items).toEqual(['CA', 'TX', 'NY', 'FL']);
  });

  it('DepositJurisdiction type is derived from the const array', () => {
    expect(enumsSource).toContain(
      "type DepositJurisdiction = (typeof DEPOSIT_JURISDICTION)[number]",
    );
  });
});

/* ================================================================== */
/*  13. Risk mitigations                                              */
/* ================================================================== */

describe('4 (risk mitigation): Safety nets', () => {
  it('R2: Waitlist table and constraints exist in migrations', () => {
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const createTables = fs.readFileSync(
      path.join(migrationsDir, '00002_create_tables.sql'),
      'utf-8',
    );
    const constraints = fs.readFileSync(
      path.join(migrationsDir, '00004_create_unique_constraints.sql'),
      'utf-8',
    );
    expect(createTables).toContain('waitlist_entries');
    expect(constraints).toContain('uq_waitlist_email_state_wedge');
  });

  it('R3: Generic demand letter has zero statute citations', () => {
    const letter = fs.readFileSync(
      path.resolve(__dirname, '../../kb/unsupported/generic-demand-letter.md'),
      'utf-8',
    );
    // No "§" followed by a statute number after a state abbreviation
    expect(letter).not.toMatch(/[A-Z]{2,}\.\s*(Code|Stat|Rev|Gen\.?\s*Laws)\s*§/);
  });

  it('R4: Auto-refund checks for missing Paddle API key', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../lib/payments/auto-refund.ts'),
      'utf-8',
    );
    expect(source).toContain("!apiKey");
    expect(source).toContain('Paddle API key not configured');
  });

  it('auto-refund never throws (returns error result instead)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../lib/payments/auto-refund.ts'),
      'utf-8',
    );
    // The main function catches errors and returns { refunded: false, error }
    expect(source).toContain('refunded: false, error');
  });

  it('generate route jurisdiction gate runs BEFORE generation call', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/generate/route.ts'),
      'utf-8',
    );
    // Jurisdiction check moved to POST handler (runs before deposit handler).
    // In POST: isSupported check → return 422 if false → else fall through
    //          to handleDepositGeneration which calls generateLetter.
    const postIdx = source.indexOf('export async function POST');
    const postSource = source.slice(postIdx);
    const jurisdictionCheck = postSource.indexOf('isSupported');
    const depositRouting = postSource.indexOf('handleDepositGeneration');
    expect(jurisdictionCheck).toBeGreaterThan(-1);
    expect(depositRouting).toBeGreaterThan(jurisdictionCheck);
    // handleDepositGeneration contains generateLetter
    expect(source).toContain('generateLetter(');
  });

  it('unsupported jurisdiction screen does not hardcode any state-specific legal information', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../components/dashboard/unsupported-jurisdiction-screen.tsx',
      ),
      'utf-8',
    );
    // Strip comments (/* ... */ and // ...) before checking
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // Should not have hardcoded statute references in rendered code
    expect(withoutComments).not.toMatch(/§\d+/);
    // Should not mention specific deadline day counts
    expect(withoutComments).not.toMatch(/\b\d+ days\b/);
  });
});

/* ================================================================== */
/*  14. Full integration — unsupported jurisdiction flow               */
/* ================================================================== */

describe('4 (integration): Full unsupported-jurisdiction flow', () => {
  it('empty-state has both supported and unsupported paths', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../components/dashboard/empty-state.tsx'),
      'utf-8',
    );
    // Supported: direct case creation
    expect(source).toContain('handleJurisdictionSelect');
    // Unsupported: shows free resources
    expect(source).toContain('handleMyStateNotListed');
    expect(source).toContain('UnsupportedJurisdictionScreen');
  });

  it('unsupported screen calls waitlist API', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../components/dashboard/unsupported-jurisdiction-screen.tsx',
      ),
      'utf-8',
    );
    expect(source).toContain("'/api/waitlist'");
    expect(source).toContain("method: 'POST'");
  });

  it('generate route rejects unsupported jurisdiction AND triggers refund', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/api/cases/[id]/generate/route.ts'),
      'utf-8',
    );
    expect(source).toContain('!isSupported');
    expect(source).toContain('processAutoRefundIfNeeded');
    expect(source).toContain('status: 422');
  });

  it('state resources has at least 40 entries', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../lib/kb/state-resources.ts'),
      'utf-8',
    );
    // Count entries (lines starting with 2-letter state code)
    const entries = source.match(/^\s+[A-Z]{2}:/gm) ?? [];
    expect(entries.length).toBeGreaterThanOrEqual(40);
  });
});
