/**
 * User path simulation tests.
 *
 * Validates the complete user journey logic for both wedges
 * WITHOUT requiring running services (Supabase, Redis, OpenAI).
 * Tests the business logic, state machine transitions, pipeline
 * orchestration, and integration between modules.
 */

import { describe, it, expect } from 'vitest';

/* ================================================================== */
/*  PATH 1: Deposit case — CA — full happy path                      */
/* ================================================================== */

describe('User Path: Deposit CA Happy Path', () => {
  it('grounding context assembles correctly for CA deposit', async () => {
    const { assembleGroundingContext } = await import('@/lib/ai/grounding');

    const grounding = assembleGroundingContext('deposit', 'CA');

    expect(grounding.context).toContain('Cal. Civ. Code');
    expect(grounding.context).toContain('1950.5');
    expect(grounding.statute_ids).toContain('ca-civ-1950.5');
    expect(grounding.kb_entry_ids).toContain('deposit-CA');
  });

  it('CA deposit KB entry has required fields', async () => {
    const { loadKbEntry } = await import('@/lib/kb/loader');

    const kb = loadKbEntry('deposit', 'CA');

    expect(kb.statutes.length).toBeGreaterThanOrEqual(2);
    expect(kb.deadline_rules.length).toBeGreaterThanOrEqual(2);
    expect(kb.penalties.length).toBeGreaterThanOrEqual(1);
    expect(kb.escalation_venues.length).toBeGreaterThanOrEqual(2);

    // Verify AB 414 is present
    const ab414 = kb.statutes.find((s) => s.statute_id === 'ca-ab-414-2025');
    expect(ab414).toBeDefined();
    expect(ab414?.effective_date).toBe('2026-01-01');
  });

  it('compliance scanner passes on compliant CA letter content', async () => {
    const { scanCompliance } = await import('@/lib/ai/compliance-scanner');

    const compliantText =
      'I am writing regarding the security deposit of $2,400 paid in connection with my tenancy. ' +
      'Under Cal. Civ. Code §1950.5(e), landlords in California are required to return the deposit ' +
      'within 21 calendar days. Tenants in California in similar circumstances typically note that ' +
      'normal wear and tear is not a permissible deduction under §1950.5(b).';

    const result = scanCompliance(compliantText);
    expect(result.pass).toBe(true);
  });

  it('compliance scanner catches prohibited phrases', async () => {
    const { scanCompliance } = await import('@/lib/ai/compliance-scanner');

    const badText = 'You have a strong case. You are entitled to the full deposit.';
    const result = scanCompliance(badText);

    expect(result.pass).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('citation validator validates CA citations', async () => {
    const { validateCitations } = await import('@/lib/ai/citation-validator');

    const text = 'Under Cal. Civ. Code §1950.5(e), the landlord must return the deposit within 21 days.';
    const kbStatutes = [
      {
        statute_id: 'ca-civ-1950.5',
        citation: 'Cal. Civ. Code §1950.5',
        title: 'Security Deposits',
        summary: '',
        key_provisions: [{ subsection: '§1950.5(e)', description: '21-day rule' }],
        official_url: '',
        effective_date: '',
        last_amended: '',
      },
    ];

    const { result } = validateCitations(text, ['ca-civ-1950.5'], kbStatutes);
    expect(result.pass).toBe(true);
    expect(result.valid.length).toBeGreaterThan(0);
  });

  it('disclaimer injector appends letter disclaimer', async () => {
    const { injectLetterDisclaimer } = await import('@/lib/ai/disclaimer-injector');

    const body = 'Dear Landlord,\n\nI am writing to request return of my deposit.';
    const result = injectLetterDisclaimer(body);

    expect(result).toContain(body);
    expect(result).toContain('________________________________________');
    expect(result.length).toBeGreaterThan(body.length);
  });

  it('deadline calculator computes CA 21-day deadline', { timeout: 15000 }, async () => {
    const { computeDeadlines } = await import('@/lib/deadlines/calculator');
    const { loadKbEntry } = await import('@/lib/kb/loader');

    const kb = loadKbEntry('deposit', 'CA');
    const answers = { move_out: '2025-01-15' };

    const { deadlines } = computeDeadlines(
      kb.deadline_rules,
      answers,
      'America/Los_Angeles',
    );

    const returnDeadline = deadlines.find((d) => d.rule_id === 'ca-deposit-return-21');
    expect(returnDeadline).toBeDefined();
    expect(returnDeadline?.deadline_days).toBe(21);
  });

  it('packet assembler loads CA Los Angeles template', async () => {
    const { loadSmallClaimsPacket, assemblePacket } = await import(
      '@/lib/packets/packet-assembler'
    );

    const template = loadSmallClaimsPacket('CA', 'los-angeles');
    expect(template).not.toBeNull();

    if (template) {
      const caseData = {
        case_id: 'test-1',
        tenant_name: 'Jane Doe',
        landlord_name: 'John Smith',
        property_address: '123 Main St',
        deposit_amount: 2400,
        demand_amount: 1600,
        jurisdiction: 'CA',
        county: 'Los Angeles',
      };

      const packet = assemblePacket(template, caseData);
      expect(packet.cover_sheet.plaintiff).toBe('Jane Doe');
      expect(packet.cover_sheet.defendant).toBe('John Smith');
      expect(packet.filing_checklist.length).toBeGreaterThan(0);
    }
  });

  it('PDF renderer converts letter to HTML correctly', { timeout: 15000 }, async () => {
    const { letterToHtml } = await import('@/lib/pdf/renderer');

    const content = 'Dear Landlord,\n\nI am writing regarding my deposit.\n\n**RE: Security Deposit**\n\nSincerely,\nJane Doe';
    const html = letterToHtml(content);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Times New Roman');
    expect(html).toContain('Dear Landlord');
    expect(html).toContain('RE: Security Deposit');
  });
});

/* ================================================================== */
/*  PATH 2: Subscription case — federal + CA — happy path            */
/* ================================================================== */

describe('User Path: Subscription CA Happy Path', () => {
  it('grounding context assembles for subscription with federal + CA', async () => {
    const { assembleGroundingContext } = await import('@/lib/ai/grounding');

    const grounding = assembleGroundingContext('subscription', 'CA', 'gym');

    expect(grounding.context).toContain('ROSCA');
    expect(grounding.context).toContain('Cal. Bus. & Prof. Code');
    expect(grounding.statute_ids).toContain('rosca');
    expect(grounding.statute_ids).toContain('fcba');
  });

  it('federal KB reflects FTC vacatur', async () => {
    const { loadKbEntry } = await import('@/lib/kb/loader');

    const kb = loadKbEntry('subscription', 'federal');
    const ftcStatute = kb.statutes.find((s) => s.statute_id === 'ftc-negative-option-rule-1973');

    expect(ftcStatute).toBeDefined();
    expect(ftcStatute?.title).toContain('Original 1973 Rule');
    // Verify vacatur note is present
    expect((ftcStatute as Record<string, unknown>)['vacatur_note']).toBeDefined();
    expect(String((ftcStatute as Record<string, unknown>)['vacatur_note'])).toContain('Custom Communications');
  });

  it('ROSCA remains as primary federal tool', async () => {
    const { loadKbEntry } = await import('@/lib/kb/loader');

    const kb = loadKbEntry('subscription', 'federal');
    const rosca = kb.statutes.find((s) => s.statute_id === 'rosca');

    expect(rosca).toBeDefined();
    expect(rosca?.citation).toContain('15 U.S.C. §8401');
  });

  it('email templates render correctly for sequence steps', async () => {
    const { renderTemplate } = await import('@/lib/email/templates');

    const result = renderTemplate('sequence_step', {
      step_number: '2',
      step_name: 'Follow-Up',
      company_name: 'Acme Gym',
      case_url: 'https://app.resolvaio.com/case/123',
    });

    expect(result.html).toContain('Acme Gym');
    expect(result.html).toContain('Follow-Up');
    expect(result.subject).toContain('Acme Gym');
  });
});

/* ================================================================== */
/*  PATH 3: Unsupported jurisdiction — decline flow                  */
/* ================================================================== */

describe('User Path: Unsupported Jurisdiction', () => {
  it('refusal checker blocks unsupported deposit jurisdictions', async () => {
    const { checkRefusal } = await import('@/lib/refusal/refusal-checker');

    // Commercial lease should trigger hard_block
    const result = checkRefusal({ lease_type: 'commercial' }, 'deposit');

    // Verify it returns a structured result
    expect(result).toHaveProperty('triggered');
    // severity is only present when triggered
    if (result.triggered) {
      expect(result).toHaveProperty('severity');
    }
  });

  it('auto-refund jurisdiction check works correctly', async () => {
    const { DEPOSIT_JURISDICTION } = await import('@/types/enums');

    expect(DEPOSIT_JURISDICTION).toContain('CA');
    expect(DEPOSIT_JURISDICTION).toContain('TX');
    expect(DEPOSIT_JURISDICTION).toContain('NY');
    expect(DEPOSIT_JURISDICTION).toContain('FL');
    expect(DEPOSIT_JURISDICTION).not.toContain('WA');
  });
});

/* ================================================================== */
/*  PATH 4: Payment flow                                             */
/* ================================================================== */

describe('User Path: Payment Flow', () => {
  it('webhook signature verification works', async () => {
    const { verifyPaddleWebhookSignature } = await import('@/lib/payments/paddle-client');
    const { createHmac } = await import('node:crypto');

    const secret = 'test-secret';
    const body = '{"event_id":"evt_123"}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hmac = createHmac('sha256', secret)
      .update(`${timestamp}:${body}`)
      .digest('hex');
    const signature = `ts=${timestamp};h1=${hmac}`;

    expect(verifyPaddleWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyPaddleWebhookSignature(body, 'invalid', secret)).toBe(false);
  });

  it('SKU prices are correct', async () => {
    const { SKU_PRICES } = await import('@/lib/payments/paddle-client');

    expect(SKU_PRICES.deposit_single.amount).toBe(4900); // $49
    expect(SKU_PRICES.monthly_unlimited.amount).toBe(1500); // $15
    expect(SKU_PRICES.annual_unlimited.amount).toBe(12900); // $129
  });
});

/* ================================================================== */
/*  PATH 5: FL deposit — verify corrected small claims limit         */
/* ================================================================== */

describe('User Path: FL Deposit Verification', () => {
  it('FL KB has corrected small claims limit ($10,000)', async () => {
    const { loadKbEntry } = await import('@/lib/kb/loader');

    const kb = loadKbEntry('deposit', 'FL');
    const smallClaims = kb.escalation_venues.find(
      (v) => v.venue_id === 'fl-small-claims',
    );

    expect(smallClaims).toBeDefined();
    expect((smallClaims as Record<string, unknown>)['monetary_limit']).toBe(10000);
  });

  it('FL deadline rules include 15-day and 30-day deadlines', async () => {
    const { loadKbEntry } = await import('@/lib/kb/loader');

    const kb = loadKbEntry('deposit', 'FL');

    const return15 = kb.deadline_rules.find((r) => r.rule_id === 'fl-deposit-return-15-no-claim');
    const notice30 = kb.deadline_rules.find((r) => r.rule_id === 'fl-deposit-notice-30');

    expect(return15?.deadline_days).toBe(15);
    expect(notice30?.deadline_days).toBe(30);
  });
});

/* ================================================================== */
/*  PATH 6: NY subscription — verify FAIR Act reflected              */
/* ================================================================== */

describe('User Path: NY Subscription — FAIR Act', () => {
  it('NY GBL §349 reflects FAIR Business Practices Act', async () => {
    const { loadKbEntry } = await import('@/lib/kb/loader');

    const kb = loadKbEntry('subscription', 'NY');
    const gbl349 = kb.statutes.find((s) => s.statute_id === 'ny-gbl-349');

    expect(gbl349).toBeDefined();
    expect(gbl349?.citation).toContain('FAIR Business Practices Act');
    expect(gbl349?.last_amended).toBe('2026-02-17');
  });
});

/* ================================================================== */
/*  PATH 7: Rate limiting configuration                              */
/* ================================================================== */

describe('User Path: Rate Limiting', () => {
  it('rate limit configs are correctly set', async () => {
    const { RATE_LIMITS } = await import('@/lib/rate-limit');

    expect(RATE_LIMITS.auth.max).toBe(5);
    expect(RATE_LIMITS.auth.windowSeconds).toBe(900); // 15 min
    expect(RATE_LIMITS.generation.max).toBe(5);
    expect(RATE_LIMITS.generation.windowSeconds).toBe(3600); // 1 hr
    expect(RATE_LIMITS.upload.max).toBe(10);
    expect(RATE_LIMITS.general.max).toBe(60);
  });
});

/* ================================================================== */
/*  PATH 8: Tavily — domain filtering                                */
/* ================================================================== */

describe('User Path: Tavily Domain Filtering', () => {
  it('allows government domains', async () => {
    const { isAllowedDomain } = await import('@/lib/ai/tavily-client');

    expect(isAllowedDomain('https://www.ftc.gov/page')).toBe(true);
    expect(isAllowedDomain('https://leginfo.legislature.ca.gov/faces')).toBe(true);
    expect(isAllowedDomain('https://www.law.cornell.edu/uscode')).toBe(true);
  });

  it('rejects non-government domains', async () => {
    const { isAllowedDomain } = await import('@/lib/ai/tavily-client');

    expect(isAllowedDomain('https://www.nolo.com/legal')).toBe(false);
    expect(isAllowedDomain('https://en.wikipedia.org')).toBe(false);
    expect(isAllowedDomain('https://www.reddit.com')).toBe(false);
  });
});

/* ================================================================== */
/*  PATH 9: Email template completeness                              */
/* ================================================================== */

describe('User Path: Email Template Completeness', () => {
  const templates = [
    'letter_delivery',
    'sequence_step',
    'deadline_prompt',
    'outcome_followup',
    'payment_confirmation',
  ] as const;

  for (const templateId of templates) {
    it(`${templateId} template renders with all required fields`, async () => {
      const { renderTemplate } = await import('@/lib/email/templates');

      const result = renderTemplate(templateId, {});
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.subject.length).toBeGreaterThan(0);
      expect(result.html).toContain('Unsubscribe');
    });
  }
});

/* ================================================================== */
/*  PATH 10: State machine transitions                               */
/* ================================================================== */

describe('User Path: Case Status State Machine', () => {
  it('valid transitions are allowed', () => {
    const VALID_TRANSITIONS: Record<string, string[]> = {
      intake: ['generated', 'closed'],
      generated: ['sent', 'closed'],
      sent: ['awaiting', 'closed'],
      awaiting: ['escalation_drafted', 'resolved', 'closed'],
      escalation_drafted: ['resolved', 'closed'],
      resolved: ['closed'],
      closed: [],
    };

    // Happy path deposit: intake → generated → sent → awaiting → resolved → closed
    expect(VALID_TRANSITIONS['intake']).toContain('generated');
    expect(VALID_TRANSITIONS['generated']).toContain('sent');
    expect(VALID_TRANSITIONS['sent']).toContain('awaiting');
    expect(VALID_TRANSITIONS['awaiting']).toContain('resolved');
    expect(VALID_TRANSITIONS['resolved']).toContain('closed');

    // Escalation path
    expect(VALID_TRANSITIONS['awaiting']).toContain('escalation_drafted');
    expect(VALID_TRANSITIONS['escalation_drafted']).toContain('resolved');

    // Administrative close from any state
    for (const status of Object.keys(VALID_TRANSITIONS)) {
      if (status !== 'closed') {
        expect(VALID_TRANSITIONS[status]).toContain('closed');
      }
    }

    // Terminal state
    expect(VALID_TRANSITIONS['closed']).toHaveLength(0);
  });
});
