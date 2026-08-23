/**
 * Subscription regression suite — S1-S20 test cases.
 *
 * Validates KB loading, grounding context, citation validation,
 * compliance scanning, and email template rendering for subscription
 * cancellation scenarios.
 */

import { describe, it, expect } from 'vitest';
import { assembleGroundingContext } from '@/lib/ai/grounding';
import { loadKbEntry } from '@/lib/kb/loader';
import { scanCompliance } from '@/lib/ai/compliance-scanner';
import { renderTemplate } from '@/lib/email/templates';
import { isAllowedDomain } from '@/lib/ai/tavily-client';

/* ------------------------------------------------------------------ */
/*  S1-S3: Federal KB verification                                   */
/* ------------------------------------------------------------------ */

describe('S1-S3: Federal KB verification', () => {
  it('S1: loads federal KB with ROSCA, FCBA, and vacated FTC rule', () => {
    const kb = loadKbEntry('subscription', 'federal');

    expect(kb.statutes.length).toBeGreaterThanOrEqual(3);

    const rosca = kb.statutes.find((s) => s.statute_id === 'rosca');
    expect(rosca).toBeDefined();

    const fcba = kb.statutes.find((s) => s.statute_id === 'fcba');
    expect(fcba).toBeDefined();

    const ftc = kb.statutes.find((s) => s.statute_id === 'ftc-negative-option-rule-1973');
    expect(ftc).toBeDefined();
  });

  it('S2: FTC vacatur is properly documented', () => {
    const kb = loadKbEntry('subscription', 'federal');
    const ftc = kb.statutes.find((s) => s.statute_id === 'ftc-negative-option-rule-1973');

    expect(ftc?.title).toContain('1973');
    expect((ftc as Record<string, unknown>)['vacatur_note']).toBeDefined();
    expect(String((ftc as Record<string, unknown>)['vacatur_note'])).toContain('Custom Communications');
  });

  it('S3: FCBA chargeback provisions confirmed', () => {
    const kb = loadKbEntry('subscription', 'federal');
    const fcba = kb.statutes.find((s) => s.statute_id === 'fcba');

    expect(fcba?.citation).toContain('15 U.S.C. §1666');
    const chargebackRule = kb.deadline_rules.find((r) => r.rule_id === 'fed-chargeback-window');
    expect(chargebackRule?.deadline_days).toBe(60);
  });
});

/* ------------------------------------------------------------------ */
/*  S4-S6: State-specific KB (CA, NY)                                */
/* ------------------------------------------------------------------ */

describe('S4-S6: State KB', () => {
  it('S4: CA ARL loads with updated AB 2863 reference', () => {
    const kb = loadKbEntry('subscription', 'CA');
    const arl = kb.statutes.find((s) => s.statute_id === 'ca-arl-17600');

    expect(arl).toBeDefined();
    expect(arl?.citation).toContain('Bus. & Prof. Code');
  });

  it('S5: NY GBL §349 reflects FAIR Act', () => {
    const kb = loadKbEntry('subscription', 'NY');
    const gbl = kb.statutes.find((s) => s.statute_id === 'ny-gbl-349');

    expect(gbl).toBeDefined();
    expect(gbl?.citation).toContain('FAIR');
    expect(gbl?.last_amended).toBe('2026-02-17');
  });

  it('S6: grounding context merges federal + state', () => {
    const grounding = assembleGroundingContext('subscription', 'CA', 'gym');

    expect(grounding.context).toContain('ROSCA');
    expect(grounding.context).toContain('Cal. Bus. & Prof. Code');
    expect(grounding.kb_entry_ids).toContain('subscription-federal');
    expect(grounding.kb_entry_ids).toContain('subscription-CA');
  });
});

/* ------------------------------------------------------------------ */
/*  S7-S10: Compliance on subscription text                          */
/* ------------------------------------------------------------------ */

describe('S7-S10: Compliance', () => {
  it('S7: first-person framing passes compliance', () => {
    const text = 'I am writing to request cancellation of my membership. Under ROSCA, you are required to provide a simple cancellation mechanism.';
    expect(scanCompliance(text).pass).toBe(true);
  });

  it('S8: prohibited phrases caught', () => {
    const text = 'You have a strong case against this company. Your attorney recommends filing.';
    expect(scanCompliance(text).pass).toBe(false);
  });

  it('S9: escalation language is allowed', () => {
    const text = 'I intend to file a complaint with the FTC if cancellation is not confirmed within 7 days.';
    expect(scanCompliance(text).pass).toBe(true);
  });

  it('S10: chargeback language is allowed', () => {
    const text = 'I will dispute all post-cancellation charges with my credit card issuer under the Fair Credit Billing Act.';
    expect(scanCompliance(text).pass).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  S11-S14: Email template rendering                                 */
/* ------------------------------------------------------------------ */

describe('S11-S14: Email templates', () => {
  it('S11: sequence_step renders with company name', () => {
    const result = renderTemplate('sequence_step', {
      step_number: '1',
      step_name: 'Initial Cancellation',
      company_name: 'Acme Gym',
    });

    expect(result.subject).toContain('Acme Gym');
    expect(result.html).toContain('Acme Gym');
  });

  it('S12: deadline_prompt renders with days remaining', () => {
    const result = renderTemplate('deadline_prompt', {
      deadline_date: '2025-03-01',
      days_remaining: '5',
      prompt_message: 'Chargeback window closing',
    });

    expect(result.subject).toContain('5 Days');
  });

  it('S13: outcome_followup renders', () => {
    const result = renderTemplate('outcome_followup', {
      days_elapsed: '14',
    });

    expect(result.html).toContain('14 days');
  });

  it('S14: all templates include disclaimer', () => {
    for (const id of ['sequence_step', 'deadline_prompt', 'outcome_followup'] as const) {
      const result = renderTemplate(id, {});
      expect(result.html).toContain('do not constitute legal advice');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  S15-S17: Tavily domain filtering                                 */
/* ------------------------------------------------------------------ */

describe('S15-S17: Tavily', () => {
  it('S15: allows FTC domain', () => {
    expect(isAllowedDomain('https://www.ftc.gov/legal-library')).toBe(true);
  });

  it('S16: allows state legislature domains', () => {
    expect(isAllowedDomain('https://leginfo.legislature.ca.gov')).toBe(true);
    expect(isAllowedDomain('https://www.nysenate.gov')).toBe(true);
  });

  it('S17: rejects non-authoritative sources', () => {
    expect(isAllowedDomain('https://www.avvo.com')).toBe(false);
    expect(isAllowedDomain('https://www.reddit.com/r/legaladvice')).toBe(false);
    expect(isAllowedDomain('https://www.nolo.com')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  S18-S20: Edge cases                                              */
/* ------------------------------------------------------------------ */

describe('S18-S20: Edge cases', () => {
  it('S18: federal-only grounding works (no state KB)', () => {
    const grounding = assembleGroundingContext('subscription', 'WA');

    // WA has no state KB — should still get federal
    expect(grounding.context).toContain('ROSCA');
    expect(grounding.statute_ids).toContain('rosca');
  });

  it('S19: empty vertical doesn\'t crash grounding', () => {
    const grounding = assembleGroundingContext('subscription', 'CA', undefined);
    expect(grounding.context.length).toBeGreaterThan(0);
  });

  it('S20: compliance scanner handles empty string', () => {
    const result = scanCompliance('');
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
