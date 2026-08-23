/**
 * Tests for deposit letter generation.
 *
 * Tests the prompt building, response parsing, and integration
 * with the compliance/citation pipeline — without calling OpenAI.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDepositSystemPrompt,
  buildDepositUserMessage,
  parseDepositResponse,
  type TenantSituation,
} from '@/lib/ai/deposit-generation';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const baseSituation: TenantSituation = {
  tenant_name: 'Jane Doe',
  property_address: '123 Main St, Los Angeles, CA 90001',
  landlord_name: 'John Smith',
  landlord_address: '456 Landlord Ave, Los Angeles, CA 90002',
  move_out_date: '2025-01-15',
  lease_start_date: '2023-01-15',
  lease_end_date: '2025-01-15',
  original_deposit_amount: 2400,
  amount_returned: 800,
  amount_withheld: 1600,
  demand_amount: 1600,
  deductions: [
    {
      description: 'Carpet cleaning',
      amount: 800,
      disputed: true,
      basis_for_dispute: 'Normal wear after 2-year tenancy',
    },
    {
      description: 'Wall painting',
      amount: 800,
      disputed: true,
      basis_for_dispute: 'Minor nail holes are normal wear',
    },
  ],
  days_since_move_out: 45,
  itemization_received: true,
  itemization_status: 'partial_return_with_itemization',
  forwarding_address_provided: true,
  forwarding_address_date: '2025-01-10',
  walkthrough_completed: false,
  additional_context: 'Unit was clean when I left',
};

const groundingStatuteIds = [
  'ca-civ-1950.5',
  'ca-civ-1950.7',
  'ca-ab-12-2024',
];

/* ------------------------------------------------------------------ */
/*  buildDepositSystemPrompt                                          */
/* ------------------------------------------------------------------ */

describe('buildDepositSystemPrompt', () => {
  it('includes grounding context in system prompt', () => {
    const prompt = buildDepositSystemPrompt('=== STATUTES ===\nTest statute');
    expect(prompt).toContain('=== STATUTES ===');
    expect(prompt).toContain('Test statute');
  });

  it('enforces third-person collective framing', () => {
    const prompt = buildDepositSystemPrompt('');
    expect(prompt).toContain('THIRD-PERSON COLLECTIVE');
    expect(prompt).toContain('Tenants in [State] in similar circumstances');
  });

  it('requires grounded citations only', () => {
    const prompt = buildDepositSystemPrompt('');
    expect(prompt).toContain('GROUNDED CITATIONS ONLY');
    expect(prompt).toContain('Do NOT fabricate');
  });

  it('prohibits evaluative language', () => {
    const prompt = buildDepositSystemPrompt('');
    expect(prompt).toContain('NO EVALUATIVE LANGUAGE');
    expect(prompt).toContain('strong case');
    expect(prompt).toContain('you are entitled');
  });

  it('requires specific letter sections', () => {
    const prompt = buildDepositSystemPrompt('');
    expect(prompt).toContain('Sender block');
    expect(prompt).toContain('Demand paragraph');
    expect(prompt).toContain('Escalation notice');
    expect(prompt).toContain('Closing and signature block');
  });

  it('specifies JSON output format', () => {
    const prompt = buildDepositSystemPrompt('');
    expect(prompt).toContain('letter_content');
    expect(prompt).toContain('rebuttal_table');
    expect(prompt).toContain('cited_statute_ids');
  });
});

/* ------------------------------------------------------------------ */
/*  buildDepositUserMessage                                           */
/* ------------------------------------------------------------------ */

describe('buildDepositUserMessage', () => {
  it('includes all tenant situation fields', () => {
    const message = buildDepositUserMessage(baseSituation);
    expect(message).toContain('Jane Doe');
    expect(message).toContain('123 Main St');
    expect(message).toContain('John Smith');
    expect(message).toContain('2025-01-15');
    expect(message).toContain('$2400');
    expect(message).toContain('$1600');
  });

  it('includes deduction details', () => {
    const message = buildDepositUserMessage(baseSituation);
    expect(message).toContain('Carpet cleaning');
    expect(message).toContain('$800');
    expect(message).toContain('DISPUTED');
    expect(message).toContain('Normal wear after 2-year tenancy');
  });

  it('includes itemization status', () => {
    const message = buildDepositUserMessage(baseSituation);
    expect(message).toContain('partial_return_with_itemization');
  });

  it('includes forwarding address info', () => {
    const message = buildDepositUserMessage(baseSituation);
    expect(message).toContain('Forwarding Address Provided: Yes');
    expect(message).toContain('2025-01-10');
  });

  it('includes walkthrough info', () => {
    const message = buildDepositUserMessage(baseSituation);
    expect(message).toContain('Move-Out Walkthrough Offered: No');
  });

  it('includes additional context', () => {
    const message = buildDepositUserMessage(baseSituation);
    expect(message).toContain('Unit was clean when I left');
  });

  it('handles minimal situation (no optional fields)', () => {
    const minimal: TenantSituation = {
      tenant_name: 'Test User',
      property_address: '789 Test St',
      landlord_name: 'Test Landlord',
      move_out_date: '2025-03-01',
      original_deposit_amount: 1000,
      amount_withheld: 1000,
      demand_amount: 1000,
      deductions: [],
      days_since_move_out: 30,
      itemization_received: false,
      itemization_status: 'nothing',
      forwarding_address_provided: false,
    };

    const message = buildDepositUserMessage(minimal);
    expect(message).toContain('Test User');
    expect(message).toContain('789 Test St');
    expect(message).not.toContain('Landlord Address');
    expect(message).not.toContain('Lease Start');
    expect(message).not.toContain('Forwarding Address Date');
    expect(message).not.toContain('Move-Out Walkthrough');
    expect(message).not.toContain('Deductions Claimed');
  });
});

/* ------------------------------------------------------------------ */
/*  parseDepositResponse                                              */
/* ------------------------------------------------------------------ */

describe('parseDepositResponse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      letter_content: 'Dear landlord,\n\nI am writing...',
      rebuttal_table: '| Deduction | Amount |\n|---|---|\n| Cleaning | $500 |',
      cited_statute_ids: ['ca-civ-1950.5'],
    });

    const result = parseDepositResponse(raw, groundingStatuteIds);
    expect(result.content).toBe('Dear landlord,\n\nI am writing...');
    expect(result.rebuttal_table).toContain('Cleaning');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.statute_id).toBe('ca-civ-1950.5');
    expect(result.citations[0]?.is_grounded).toBe(true);
  });

  it('strips markdown fences from response', () => {
    const raw = '```json\n' + JSON.stringify({
      letter_content: 'Test letter',
      cited_statute_ids: [],
    }) + '\n```';

    const result = parseDepositResponse(raw, groundingStatuteIds);
    expect(result.content).toBe('Test letter');
  });

  it('filters out ungrounded statute IDs', () => {
    const raw = JSON.stringify({
      letter_content: 'Test',
      cited_statute_ids: ['ca-civ-1950.5', 'fake-statute-999'],
    });

    const result = parseDepositResponse(raw, groundingStatuteIds);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.statute_id).toBe('ca-civ-1950.5');
  });

  it('handles response with no rebuttal table', () => {
    const raw = JSON.stringify({
      letter_content: 'Test letter',
      rebuttal_table: null,
      cited_statute_ids: ['ca-civ-1950.5'],
    });

    const result = parseDepositResponse(raw, groundingStatuteIds);
    expect(result.rebuttal_table).toBeUndefined();
  });

  it('throws on missing letter_content', () => {
    const raw = JSON.stringify({
      cited_statute_ids: ['ca-civ-1950.5'],
    });

    expect(() => parseDepositResponse(raw, groundingStatuteIds)).toThrow(
      'letter_content',
    );
  });

  it('throws on invalid JSON', () => {
    expect(() =>
      parseDepositResponse('not json', groundingStatuteIds),
    ).toThrow();
  });

  it('handles empty cited_statute_ids', () => {
    const raw = JSON.stringify({
      letter_content: 'Test letter',
      cited_statute_ids: [],
    });

    const result = parseDepositResponse(raw, groundingStatuteIds);
    expect(result.citations).toHaveLength(0);
  });

  it('handles missing cited_statute_ids field', () => {
    const raw = JSON.stringify({
      letter_content: 'Test letter',
    });

    const result = parseDepositResponse(raw, groundingStatuteIds);
    expect(result.citations).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Integration with compliance scanner                                */
/* ------------------------------------------------------------------ */

describe('compliance integration', () => {
  it('generated letter content can be scanned by compliance scanner', async () => {
    const { scanCompliance } = await import('@/lib/ai/compliance-scanner');

    // Simulate a compliant letter
    const compliantText =
      'I am writing regarding the security deposit of $2,400. ' +
      'Under Cal. Civ. Code §1950.5(e), landlords in California are ' +
      'required to return a tenant\'s security deposit within 21 days. ' +
      'Tenants in California in similar circumstances typically note that ' +
      'normal wear and tear is not a permissible deduction.';

    const result = scanCompliance(compliantText);
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects prohibited phrases in letter content', async () => {
    const { scanCompliance } = await import('@/lib/ai/compliance-scanner');

    const nonCompliantText =
      'You have a strong case. You are entitled to the full deposit. ' +
      'Your landlord violated the law.';

    const result = scanCompliance(nonCompliantText);
    expect(result.pass).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Integration with citation validator                                */
/* ------------------------------------------------------------------ */

describe('citation validation integration', () => {
  it('validates grounded citations in letter text', async () => {
    const { validateCitations } = await import('@/lib/ai/citation-validator');

    const letterText =
      'Under Cal. Civ. Code §1950.5(e), landlords must return ' +
      'the deposit within 21 days.';

    const kbStatutes = [
      {
        statute_id: 'ca-civ-1950.5',
        citation: 'Cal. Civ. Code §1950.5',
        title: 'Security Deposits',
        summary: 'Test',
        key_provisions: [
          { subsection: '§1950.5(e)', description: '21-day rule' },
        ],
        official_url: 'https://example.com',
        effective_date: '1970-01-01',
        last_amended: '2024-07-01',
      },
    ];

    const { result } = validateCitations(
      letterText,
      ['ca-civ-1950.5'],
      kbStatutes,
    );

    expect(result.pass).toBe(true);
    expect(result.valid.length).toBeGreaterThan(0);
  });

  it('strips ungrounded citations', async () => {
    const { validateCitations } = await import('@/lib/ai/citation-validator');

    const letterText =
      'Under Cal. Civ. Code §1950.5(e), and also under N.Y. Gen. Bus. Law §777, ' +
      'landlords must return the deposit.';

    const kbStatutes = [
      {
        statute_id: 'ca-civ-1950.5',
        citation: 'Cal. Civ. Code §1950.5',
        title: 'Security Deposits',
        summary: 'Test',
        key_provisions: [
          { subsection: '§1950.5(e)', description: '21-day rule' },
        ],
        official_url: 'https://example.com',
        effective_date: '1970-01-01',
        last_amended: '2024-07-01',
      },
    ];

    const { result, cleanedText } = validateCitations(
      letterText,
      ['ca-civ-1950.5'],
      kbStatutes,
    );

    expect(result.stripped.length).toBeGreaterThan(0);
    expect(cleanedText).not.toContain('N.Y. Gen. Bus. Law §777');
  });
});

/* ------------------------------------------------------------------ */
/*  Integration with disclaimer injector                               */
/* ------------------------------------------------------------------ */

describe('disclaimer injection integration', () => {
  it('injects letter disclaimer with separator', async () => {
    const { injectLetterDisclaimer } = await import(
      '@/lib/ai/disclaimer-injector'
    );

    const letterBody = 'Dear Landlord,\n\nI am writing...';
    const result = injectLetterDisclaimer(letterBody);

    expect(result).toContain(letterBody);
    expect(result).toContain('________________________________________');
    expect(result.length).toBeGreaterThan(letterBody.length);
  });
});
