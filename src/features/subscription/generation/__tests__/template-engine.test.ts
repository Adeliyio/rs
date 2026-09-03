/**
 * Tests for the deterministic subscription cancellation template engine.
 *
 * These tests assert the full required-elements checklist that the former
 * GPT-4o system prompt enforced (email 1 a–i, email 2 a–h, email 3 a–g),
 * conditional rendering, grounded-only citations, placeholder preservation,
 * compliance-scanner cleanliness, and zero AI dependency.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  generateSubscriptionSequenceFromTemplates,
  selectPrimaryStatute,
  parseGroundingCitations,
} from '@/features/subscription/generation/template-engine';
import { scanCompliance } from '@/lib/ai/compliance-scanner';
import type { UserSituation } from '@/lib/ai/generation';
import type { Vertical } from '@/types/enums';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

/**
 * A grounding-context string in the exact shape emitted by
 * grounding.ts `formatStatutes` — `[statute_id] citation` on each line.
 * Includes a CA state statute plus the three federal ids.
 */
const CA_GROUNDING_CONTEXT = `=== APPLICABLE STATUTES ===
  [ca-arl-17600] Cal. Bus. & Prof. Code §17602
  Title: California Automatic Renewal Law (ARL)
  Summary: Requires businesses to clearly disclose automatic renewal terms.

  [rosca] 15 U.S.C. §8403
  Title: Restore Online Shoppers' Confidence Act (ROSCA)
  Summary: Federal law prohibiting negative-option charges without consent.

  [ftc-negative-option-rule-1973] 16 CFR Part 425
  Title: FTC Negative Option Rule
  Summary: Original 1973 rule.

  [fcba] 15 U.S.C. §1666 (Fair Credit Billing Act)
  Title: Fair Credit Billing Act
  Summary: Dispute rights for unauthorized charges.`;

const CA_STATUTE_IDS = [
  'ca-arl-17600',
  'rosca',
  'ftc-negative-option-rule-1973',
  'fcba',
];

/** Federal-only grounding (no state statute) — federal fallback path. */
const FEDERAL_GROUNDING_CONTEXT = `=== APPLICABLE STATUTES ===
  [rosca] 15 U.S.C. §8403
  Title: Restore Online Shoppers' Confidence Act (ROSCA)

  [ftc-negative-option-rule-1973] 16 CFR Part 425
  Title: FTC Negative Option Rule

  [fcba] 15 U.S.C. §1666 (Fair Credit Billing Act)
  Title: Fair Credit Billing Act`;

const FEDERAL_STATUTE_IDS = ['rosca', 'ftc-negative-option-rule-1973', 'fcba'];

const VERTICALS: Vertical[] = ['gym', 'telecom', 'streaming', 'saas', 'mobile_app'];

function baseSituation(overrides: Partial<UserSituation> = {}): UserSituation {
  return {
    company_name: 'FitLife Gym',
    service_type: 'gym',
    account_identifier: 'MEMBER-12345',
    billing_email: 'user@example.com',
    monthly_charge: '49.99',
    billing_frequency: 'Monthly',
    last_charge_date: '2026-05-15',
    cancellation_effective_date: 'immediately',
    cancellation_barriers: [],
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Structure: 3 steps with correct numbers / names / timing          */
/* ------------------------------------------------------------------ */

describe('template-engine — structure per vertical', () => {
  for (const vertical of VERTICALS) {
    it(`generates exactly 3 correctly-shaped steps for ${vertical}`, () => {
      const steps = generateSubscriptionSequenceFromTemplates(
        CA_GROUNDING_CONTEXT,
        CA_STATUTE_IDS,
        baseSituation(),
        vertical,
      );

      expect(steps).toHaveLength(3);

      expect(steps[0]?.step_number).toBe(1);
      expect(steps[1]?.step_number).toBe(2);
      expect(steps[2]?.step_number).toBe(3);

      expect(steps[0]?.name).toBe('Formal Cancellation Demand');
      expect(steps[1]?.name).toBe('Follow-Up with Escalation Notice');
      expect(steps[2]?.name).toBe('Final Notice Before Regulatory Complaint');

      expect(steps[0]?.timing_description).toContain('Day 0');
      expect(steps[1]?.timing_description).toContain('Day 7');
      expect(steps[2]?.timing_description).toContain('Day 14');

      // Subjects and bodies non-empty
      for (const step of steps) {
        expect(step.subject.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
      }
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Email 1 required elements (a–i)                                    */
/* ------------------------------------------------------------------ */

describe('template-engine — email 1 required elements (a–i)', () => {
  it('includes every required element', () => {
    const situation = baseSituation({
      wants_refund: true,
      refund_amount: '49.99',
      refund_reason: 'charged after my cancellation request',
      previous_cancellation_date: '2026-04-20',
      previous_cancellation_method: 'phone call to support',
      previous_cancellation_result: 'they refused to cancel',
    });
    const steps = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      situation,
      'gym',
    );
    const body = steps[0]?.body ?? '';

    // (a) address company by name
    expect(body).toContain('Dear FitLife Gym,');
    // (b) account identifier
    expect(body).toContain('MEMBER-12345');
    // (c) revoke authorization (verbatim)
    expect(body).toContain(
      'I am revoking authorization for any future charges to my payment method.',
    );
    // (d) requested effective date
    expect(body).toMatch(/effective immediately/i);
    // (e) cite primary statute (CA ARL preferred over federal)
    expect(body).toContain('Cal. Bus. & Prof. Code §17602');
    // (f) written confirmation within 7 business days — three specifics
    expect(body).toContain('7 business days');
    expect(body).toContain('cancelled');
    expect(body).toContain('auto-renewal is disabled');
    expect(body).toContain('no further charges');
    // (g) refund amount + basis
    expect(body).toContain('$49.99');
    expect(body).toMatch(/basis for this request/i);
    // (h) prior cancellation attempt: date/method/result
    expect(body).toContain('2026-04-20');
    expect(body).toContain('phone call to support');
    expect(body).toContain('they refused to cancel');
    // (i) sign off — name + date only. A real cancellation email is sent from the
    //     person's own inbox, so no "[YOUR EMAIL]" signature line (it would read
    //     like an unfilled form field, not a signature).
    expect(body).toContain('[YOUR NAME]');
    expect(body).toContain('[DATE]');
    expect(body).not.toContain('[YOUR EMAIL]');
  });
});

/* ------------------------------------------------------------------ */
/*  Email 2 required elements (a–h)                                    */
/* ------------------------------------------------------------------ */

describe('template-engine — email 2 required elements (a–h)', () => {
  it('includes every required element', () => {
    const situation = baseSituation({
      wants_refund: true,
      refund_amount: '49.99',
      last_charge_date: '2026-05-15',
    });
    const steps = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      situation,
      'gym',
    );
    const body = steps[1]?.body ?? '';

    // (a) reference a prior email by a fillable date (NOT today — that produced
    // a self-contradictory timeline, so back-references use a distinct token).
    expect(body).toContain('my email of [DATE YOU SENT THE PREVIOUS EMAIL]');
    // (b) note lack of response
    expect(body).toMatch(/not received the written confirmation/i);
    // (c) restate account id
    expect(body).toContain('MEMBER-12345');
    // (d) charges since email 1
    expect(body).toContain('2026-05-15');
    expect(body).toContain('$49.99');
    // (e) name regulatory agency (CA => state AG)
    expect(body).toContain('California Attorney General');
    // (f) FCBA chargeback rights
    expect(body).toContain('Fair Credit Billing Act');
    // (g) firm 7-day deadline
    expect(body).toMatch(/within 7 days/i);
    // (h) sign off
    expect(body).toContain('[YOUR NAME]');
    expect(body).toContain('[DATE]');
  });

  it('names the FTC for federal-only jurisdictions', () => {
    const steps = generateSubscriptionSequenceFromTemplates(
      FEDERAL_GROUNDING_CONTEXT,
      FEDERAL_STATUTE_IDS,
      baseSituation({ company_name: 'StreamCo', service_type: 'streaming' }),
      'streaming',
    );
    const body = steps[1]?.body ?? '';
    expect(body).toContain('Federal Trade Commission');
  });
});

/* ------------------------------------------------------------------ */
/*  Email 3 required elements (a–g)                                    */
/* ------------------------------------------------------------------ */

describe('template-engine — email 3 required elements (a–g)', () => {
  it('includes every required element', () => {
    const steps = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation(),
      'gym',
    );
    const body = steps[2]?.body ?? '';

    // (a) reference both prior emails by a fillable prior-date placeholder (two)
    const dateRefs = body.match(/email of \[DATE YOU SENT THE PREVIOUS EMAIL\]|follow-up of \[DATE YOU SENT THE PREVIOUS EMAIL\]/g) ?? [];
    expect(dateRefs.length).toBeGreaterThanOrEqual(2);
    // (b) final written request before regulatory complaint
    expect(body).toMatch(/final written request/i);
    // (c) FTC complaint URL + CFPB (applicable since FCBA grounded)
    expect(body).toContain('ftc.gov/complaint');
    expect(body).toContain('consumerfinance.gov/complaint');
    // (d) charges after cancellation disputed with card issuer
    expect(body).toMatch(/disputed with my card issuer/i);
    // (e) cite applicable statute once more
    expect(body).toContain('Cal. Bus. & Prof. Code §17602');
    // (f) request immediate written confirmation
    expect(body).toMatch(/immediate written confirmation/i);
    // (g) sign off
    expect(body).toContain('[YOUR NAME]');
  });

  it('omits CFPB URL when FCBA is not grounded', () => {
    const groundingNoFcba = `=== APPLICABLE STATUTES ===
  [ca-arl-17600] Cal. Bus. & Prof. Code §17602
  Title: California Automatic Renewal Law (ARL)

  [rosca] 15 U.S.C. §8403
  Title: ROSCA`;
    const steps = generateSubscriptionSequenceFromTemplates(
      groundingNoFcba,
      ['ca-arl-17600', 'rosca'],
      baseSituation(),
      'gym',
    );
    const body = steps[2]?.body ?? '';
    expect(body).toContain('ftc.gov/complaint');
    expect(body).not.toContain('consumerfinance.gov/complaint');
  });
});

/* ------------------------------------------------------------------ */
/*  Citations: grounded-only                                          */
/* ------------------------------------------------------------------ */

describe('template-engine — citations are grounded-only', () => {
  it('only cites ids present in the grounding set', () => {
    const steps = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation(),
      'gym',
    );
    const groundingSet = new Set(CA_STATUTE_IDS);
    for (const step of steps) {
      for (const citation of step.citations) {
        expect(groundingSet.has(citation.statute_id)).toBe(true);
        expect(citation.is_grounded).toBe(true);
      }
    }
    // Primary CA statute is cited in email 1
    expect(steps[0]?.citations.some((c) => c.statute_id === 'ca-arl-17600')).toBe(true);
  });

  it('does not cite an id that is absent from the grounding set', () => {
    // ny-gbl-527a is NOT in the CA grounding set — must never be cited.
    const steps = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation(),
      'gym',
    );
    for (const step of steps) {
      expect(step.citations.some((c) => c.statute_id === 'ny-gbl-527a')).toBe(false);
    }
  });

  it('selectPrimaryStatute prefers state over federal', () => {
    const map = parseGroundingCitations(CA_GROUNDING_CONTEXT, CA_STATUTE_IDS);
    const primary = selectPrimaryStatute(map, CA_STATUTE_IDS);
    expect(primary?.statute_id).toBe('ca-arl-17600');
  });

  it('selectPrimaryStatute falls back to rosca federal when no state statute', () => {
    const map = parseGroundingCitations(FEDERAL_GROUNDING_CONTEXT, FEDERAL_STATUTE_IDS);
    const primary = selectPrimaryStatute(map, FEDERAL_STATUTE_IDS);
    expect(primary?.statute_id).toBe('rosca');
    expect(primary?.citation_text).toContain('15 U.S.C. §8403');
  });
});

/* ------------------------------------------------------------------ */
/*  Conditional rendering                                             */
/* ------------------------------------------------------------------ */

describe('template-engine — conditional rendering', () => {
  it('includes refund clause when wants_refund, omits it otherwise', () => {
    const withRefund = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation({ wants_refund: true, refund_amount: '99.00' }),
      'gym',
    );
    expect(withRefund[0]?.body).toContain('requesting a refund');
    expect(withRefund[0]?.body).toContain('$99.00');

    const withoutRefund = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation({ wants_refund: false }),
      'gym',
    );
    expect(withoutRefund[0]?.body).not.toContain('requesting a refund');
  });

  it('never renders a double dollar sign, whether the amount is bare or $-prefixed', () => {
    for (const amount of ['29.99', '$29.99']) {
      const steps = generateSubscriptionSequenceFromTemplates(
        CA_GROUNDING_CONTEXT,
        CA_STATUTE_IDS,
        baseSituation({
          wants_refund: true,
          refund_amount: amount,
          monthly_charge: amount,
          last_charge_date: '2026-04-05',
        }),
        'gym',
      );
      for (const step of steps) {
        expect(step.body).not.toContain('$$');
      }
      expect(steps[0]?.body).toContain('$29.99');
    }
  });

  it('references prior cancellation when present, omits it otherwise', () => {
    const withPrior = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation({
        previous_cancellation_date: '2026-04-20',
        previous_cancellation_method: 'certified letter',
        previous_cancellation_result: 'no response',
      }),
      'gym',
    );
    expect(withPrior[0]?.body).toContain('previously attempted to cancel');
    expect(withPrior[0]?.body).toContain('certified letter');

    const withoutPrior = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation({
        previous_cancellation_date: undefined,
        previous_cancellation_method: undefined,
        previous_cancellation_result: undefined,
      }),
      'gym',
    );
    expect(withoutPrior[0]?.body).not.toContain('previously attempted to cancel');
  });
});

/* ------------------------------------------------------------------ */
/*  Placeholders preserved across all steps                           */
/* ------------------------------------------------------------------ */

describe('template-engine — placeholders', () => {
  it('preserves [YOUR NAME] + [DATE] in every step, and never an email signature line', () => {
    const steps = generateSubscriptionSequenceFromTemplates(
      CA_GROUNDING_CONTEXT,
      CA_STATUTE_IDS,
      baseSituation(),
      'gym',
    );
    for (const step of steps) {
      expect(step.body).toContain('[YOUR NAME]');
      expect(step.body).toContain('[DATE]');
      // The email is the From: header, not a signature line — see signOff().
      expect(step.body).not.toContain('[YOUR EMAIL]');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Compliance scanner — must pass for a representative sample        */
/* ------------------------------------------------------------------ */

describe('template-engine — compliance', () => {
  for (const vertical of VERTICALS) {
    it(`output passes scanCompliance for ${vertical} (full situation)`, () => {
      const steps = generateSubscriptionSequenceFromTemplates(
        CA_GROUNDING_CONTEXT,
        CA_STATUTE_IDS,
        baseSituation({
          company_name: `${vertical}-Co`,
          service_type: vertical,
          wants_refund: true,
          refund_amount: '49.99',
          refund_reason: 'charged after cancellation request',
          previous_cancellation_date: '2026-04-20',
          previous_cancellation_method: 'online form',
          previous_cancellation_result: 'no confirmation received',
        }),
        vertical,
      );
      for (const step of steps) {
        const scan = scanCompliance(step.body);
        expect(
          scan.pass,
          `Violations in ${vertical} step ${step.step_number}: ${JSON.stringify(scan.violations)}`,
        ).toBe(true);
      }
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Zero OpenAI — module must not import the AI client / AI_CONFIG     */
/* ------------------------------------------------------------------ */

describe('template-engine — zero AI dependency', () => {
  it('source does not import openai-client or reference AI_CONFIG', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/features/subscription/generation/template-engine.ts'),
      'utf-8',
    );
    // Strip comments so prose mentions ("must not reference AI_CONFIG") don't
    // trip the check — we care only about executable imports/references.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('openai-client');
    expect(code).not.toContain('AI_CONFIG');
    expect(code).not.toContain('getOpenAIClient');
    // No import from the AI client module of any kind.
    expect(code).not.toMatch(/from\s+['"]@\/lib\/ai\/openai-client['"]/);
    expect(code).not.toMatch(/from\s+['"]@\/config\/ai\.config['"]/);
  });
});

/* ------------------------------------------------------------------ */
/*  Regression fixtures — all 5 verticals produce valid sequences     */
/* ------------------------------------------------------------------ */

describe('template-engine — regression fixtures across verticals', () => {
  for (const vertical of VERTICALS) {
    it(`produces a compliant, grounded 3-step sequence for ${vertical}`, () => {
      const steps = generateSubscriptionSequenceFromTemplates(
        CA_GROUNDING_CONTEXT,
        CA_STATUTE_IDS,
        baseSituation({ company_name: `${vertical} Provider`, service_type: vertical }),
        vertical,
      );
      expect(steps).toHaveLength(3);
      // Each step carries at least one grounded citation.
      for (const step of steps) {
        expect(step.citations.length).toBeGreaterThan(0);
        expect(step.citations.every((c) => c.is_grounded)).toBe(true);
      }
    });
  }
});
