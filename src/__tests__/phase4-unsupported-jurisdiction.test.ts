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
/*  2. Waitlist table exists in the Convex schema                     */
/* ================================================================== */

describe('4a (risk): Waitlist table exists in the Convex schema', () => {
  const schemaPath = path.resolve(__dirname, '../../convex/schema.ts');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  it('waitlistEntries table is defined in the Convex schema', () => {
    expect(schema).toContain('waitlistEntries: defineTable(');
  });

  it('waitlistEntries has an index on (state, wedge)', () => {
    expect(schema).toContain("by_state_wedge', ['state', 'wedge']");
  });

  it('waitlistEntries enforces uniqueness on (email, state, wedge)', () => {
    // Convex has no unique constraints; the uq_waitlist_email_state_wedge
    // constraint is replaced by this index + an in-mutation uniqueness check.
    expect(schema).toContain("by_email_state_wedge', ['email', 'state', 'wedge']");
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
/*  4. Unsupported jurisdiction is handled in the diagnostic shell    */
/* ================================================================== */

// The state is now collected ONCE by the diagnostic's first question (no
// EmptyState modal — that was the double-ask). So the "unsupported state" flow
// moved from a modal in empty-state.tsx to the diagnostic shell reaching the
// deposit graph's unsupported_jurisdiction terminal. These tests assert it at
// its new home and that the resources screen is not degraded to a plain
// "complete" screen.
describe('4b (cont): Diagnostic shell — unsupported jurisdiction flow', () => {
  const shellSource = fs.readFileSync(
    path.resolve(__dirname, '../features/diagnostic/components/diagnostic-shell.tsx'),
    'utf-8',
  );
  const emptyStateSource = fs.readFileSync(
    path.resolve(__dirname, '../components/dashboard/empty-state.tsx'),
    'utf-8',
  );

  it('the authed diagnostic shell imports UnsupportedJurisdictionScreen', () => {
    expect(shellSource).toContain('import { UnsupportedJurisdictionScreen }');
    expect(shellSource).toContain('import { STATE_RESOURCES }');
  });

  it('renders UnsupportedJurisdictionScreen on the unsupported_jurisdiction terminal', () => {
    expect(shellSource).toContain("terminal_type === 'unsupported_jurisdiction'");
    expect(shellSource).toContain('<UnsupportedJurisdictionScreen');
    expect(shellSource).toContain("STATE_RESOURCES[stateCode]");
  });

  it('passes the generic letter URL to the screen', () => {
    // Served via an API route that reads the KB file server-side — a raw
    // /kb/*.md link 404s in production (kb/ is not a served static asset).
    expect(shellSource).toContain('/api/kb/generic-demand-letter');
  });

  it('the unsupported screen precedes the generic completion screen', () => {
    // Order matters: the unsupported terminal also sets isComplete, so the
    // specific screen must be checked BEFORE the generic "Diagnostic complete".
    const unsupportedIdx = shellSource.indexOf("terminal_type === 'unsupported_jurisdiction'");
    const completeIdx = shellSource.indexOf('Diagnostic complete');
    expect(unsupportedIdx).toBeGreaterThan(-1);
    expect(completeIdx).toBeGreaterThan(unsupportedIdx);
  });

  it('EmptyState no longer collects the state (no modal — single ask in the diagnostic)', () => {
    // The old double-ask: a modal here + the graph re-asking. The modal is gone;
    // EmptyState creates the case with NO jurisdiction and the diagnostic asks.
    expect(emptyStateSource).not.toContain('Select your state');
    expect(emptyStateSource).not.toContain('handleMyStateNotListed');
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
      "processAutoRefundIfNeeded",
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

  it('looks up polar_order_id for refund', () => {
    expect(generateSource).toContain('polar_order_id');
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
    // The payment gate accepts a per-case payment OR an active subscription
    // ("Unlimited" waiver); anchor on the 402 error message, which is stable.
    const paymentGate = generateSource.indexOf('Payment required before letter generation');
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

  it('calls the Polar refund API for refund', () => {
    expect(autoRefundSource).toContain('requestPolarRefund');
    expect(autoRefundSource).toContain('polar.refunds.create');
    expect(autoRefundSource).toContain('orderId');
  });

  it('refunds through the single Polar client (getPolar)', () => {
    expect(autoRefundSource).toContain('getPolar()');
  });

  it('handles a missing Polar access token gracefully', () => {
    expect(autoRefundSource).toContain('Polar access token not configured');
    expect(autoRefundSource).toContain("ok: false");
  });

  it('uses the Polar server flag rather than hardcoded Paddle URLs', () => {
    // The single Polar client selects sandbox/production from POLAR_SERVER; the
    // refund code no longer builds Paddle REST URLs.
    expect(autoRefundSource).not.toContain('paddle.com');
    expect(autoRefundSource).toContain('POLAR_ACCESS_TOKEN');
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
/*  10. Convex schema — core tables are defined                       */
/* ================================================================== */

describe('4d: Convex schema — core tables', () => {
  const schemaPath = path.resolve(__dirname, '../../convex/schema.ts');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  it('has the waitlistEntries table', () => {
    expect(schema).toContain('waitlistEntries: defineTable(');
  });

  it('waitlistEntries has email and state fields', () => {
    // The table block runs from its defineTable( to the next top-level table.
    const block = schema.slice(schema.indexOf('waitlistEntries: defineTable('));
    expect(block).toContain('email: v.string()');
    expect(block).toContain('state: v.string()');
  });

  it('has the cases table', () => {
    expect(schema).toContain('cases: defineTable(');
  });

  it('has all core tables defined', () => {
    // Convex camelCase table names (former snake_case Supabase tables).
    const expectedTables = [
      'cases',
      'letters',
      'sequences',
      'documents',
      'packets',
      'deadlineEvents',
      'outcomes',
      'caseStatusHistory',
      'subscriptions',
      'waitlistEntries',
      'webhookEvents',
      'auditLog',
    ];
    for (const table of expectedTables) {
      expect(schema).toContain(`${table}: defineTable(`);
    }
  });

  it('defines the app users table (Better Auth mirror)', () => {
    // Under Better Auth, the component owns its user/session/account tables; our
    // schema keeps a thin `users` mirror (written by the onCreate trigger) that
    // every FK references. It replaced the former `...authTables` spread.
    expect(schema).toContain('users: defineTable(');
    expect(schema).not.toContain('...authTables');
  });
});

/* ================================================================== */
/*  11. @ts-expect-error audit                                        */
/* ================================================================== */

describe('4d (cont): no residual Supabase type workarounds', () => {
  // The Supabase migration removed the SSR-typed client that forced TS
  // suppression directives in these hot-path files. This guards against a
  // regression that reintroduces either.
  const filesToCheck = [
    '../app/api/cases/[id]/generate/route.ts',
    '../app/api/cases/[id]/status/route.ts',
    '../app/api/sequences/[id]/advance/route.ts',
    '../lib/payments/webhook-processor.ts',
    '../lib/payments/auto-refund.ts',
  ];

  it('these hot-path files carry no TS suppression directives', () => {
    const directive = ['@ts', 'expect-error'].join('-');
    for (const filePath of filesToCheck) {
      const source = fs.readFileSync(
        path.resolve(__dirname, filePath),
        'utf-8',
      );
      expect(source).not.toContain(directive);
    }
  });

  it('these hot-path files no longer import a Supabase client', () => {
    for (const filePath of filesToCheck) {
      const source = fs.readFileSync(
        path.resolve(__dirname, filePath),
        'utf-8',
      );
      expect(source.toLowerCase()).not.toContain('supabase');
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
  it('R2: Waitlist table and uniqueness index exist in the Convex schema', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../../convex/schema.ts'),
      'utf-8',
    );
    expect(schema).toContain('waitlistEntries: defineTable(');
    expect(schema).toContain("by_email_state_wedge', ['email', 'state', 'wedge']");
  });

  it('R3: Generic demand letter has zero statute citations', () => {
    const letter = fs.readFileSync(
      path.resolve(__dirname, '../../kb/unsupported/generic-demand-letter.md'),
      'utf-8',
    );
    // No "§" followed by a statute number after a state abbreviation
    expect(letter).not.toMatch(/[A-Z]{2,}\.\s*(Code|Stat|Rev|Gen\.?\s*Laws)\s*§/);
  });

  it('R4: Auto-refund checks for a missing Polar access token', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../lib/payments/auto-refund.ts'),
      'utf-8',
    );
    expect(source).toContain('!process.env.POLAR_ACCESS_TOKEN');
    expect(source).toContain('Polar access token not configured');
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
  it('supported and unsupported paths both run through the diagnostic', () => {
    // EmptyState just starts the wedge (no state modal); the diagnostic graph
    // owns BOTH paths: supported states advance into the diagnostic, and the
    // 'Another state' option routes to the unsupported_jurisdiction terminal,
    // which the shell renders as the free-resources screen.
    const emptyState = fs.readFileSync(
      path.resolve(__dirname, '../components/dashboard/empty-state.tsx'),
      'utf-8',
    );
    expect(emptyState).toContain("createCase('deposit')");
    expect(emptyState).not.toContain('handleMyStateNotListed');

    const shell = fs.readFileSync(
      path.resolve(__dirname, '../features/diagnostic/components/diagnostic-shell.tsx'),
      'utf-8',
    );
    expect(shell).toContain('UnsupportedJurisdictionScreen');
    expect(shell).toContain("terminal_type === 'unsupported_jurisdiction'");
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
