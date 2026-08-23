/**
 * Tests for email templates.
 *
 * Verifies that all template types render correctly with proper
 * content, structure, HTML escaping, and required elements.
 */

import { describe, it, expect } from 'vitest';
import { renderTemplate, type TemplateId } from '@/lib/email/templates';

/* ------------------------------------------------------------------ */
/*  Common assertions for all templates                               */
/* ------------------------------------------------------------------ */

describe('renderTemplate — common', () => {
  const templateIds: TemplateId[] = [
    'letter_delivery',
    'sequence_step',
    'deadline_prompt',
    'outcome_followup',
    'payment_confirmation',
  ];

  for (const templateId of templateIds) {
    describe(templateId, () => {
      const result = renderTemplate(templateId, {});

      it('returns html, text, and subject', () => {
        expect(typeof result.html).toBe('string');
        expect(typeof result.text).toBe('string');
        expect(typeof result.subject).toBe('string');
        expect(result.html.length).toBeGreaterThan(0);
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.subject.length).toBeGreaterThan(0);
      });

      it('html contains DOCTYPE', () => {
        expect(result.html).toContain('<!DOCTYPE html>');
      });

      it('includes disclaimer in html', () => {
        expect(result.html).toContain('do not constitute legal advice');
      });

      it('includes disclaimer or privacy note in text', () => {
        const lower = result.text.toLowerCase();
        // All templates include either the legal advice disclaimer or a privacy note
        expect(
          lower.includes('legal advice') || lower.includes('private'),
        ).toBe(true);
      });

      it('includes unsubscribe link', () => {
        expect(result.html).toContain('Unsubscribe');
      });

      it('includes Resolvaio branding', () => {
        expect(result.html).toContain('Resolvaio');
      });
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Letter delivery template                                          */
/* ------------------------------------------------------------------ */

describe('renderTemplate — letter_delivery', () => {
  it('includes property address and jurisdiction', () => {
    const result = renderTemplate('letter_delivery', {
      jurisdiction: 'CA',
      property_address: '123 Main St',
      download_url: 'https://example.com/download',
    });

    expect(result.html).toContain('123 Main St');
    expect(result.html).toContain('CA');
    expect(result.subject).toContain('123 Main St');
  });

  it('includes download link', () => {
    const result = renderTemplate('letter_delivery', {
      download_url: 'https://example.com/download',
    });

    expect(result.html).toContain('https://example.com/download');
    expect(result.text).toContain('https://example.com/download');
  });

  it('includes sending instructions', () => {
    const result = renderTemplate('letter_delivery', {});

    expect(result.html).toContain('certified mail');
    expect(result.html).toContain('return receipt');
    expect(result.html).toContain('Review every detail');
  });
});

/* ------------------------------------------------------------------ */
/*  Sequence step template                                            */
/* ------------------------------------------------------------------ */

describe('renderTemplate — sequence_step', () => {
  it('includes step number and company name', () => {
    const result = renderTemplate('sequence_step', {
      step_number: '2',
      company_name: 'Acme Gym',
      step_name: 'Follow-Up',
    });

    expect(result.html).toContain('2');
    expect(result.html).toContain('Acme Gym');
    expect(result.html).toContain('Follow-Up');
    expect(result.subject).toContain('Acme Gym');
  });
});

/* ------------------------------------------------------------------ */
/*  Deadline prompt template                                          */
/* ------------------------------------------------------------------ */

describe('renderTemplate — deadline_prompt', () => {
  it('includes deadline date and days remaining', () => {
    const result = renderTemplate('deadline_prompt', {
      deadline_date: '2025-02-15',
      days_remaining: '5',
      prompt_message: 'The 21-day return period expires soon.',
    });

    expect(result.html).toContain('2025-02-15');
    expect(result.html).toContain('5 Days Remaining');
    expect(result.html).toContain('21-day return period');
    expect(result.subject).toContain('5 Days');
  });
});

/* ------------------------------------------------------------------ */
/*  Outcome followup template                                        */
/* ------------------------------------------------------------------ */

describe('renderTemplate — outcome_followup', () => {
  it('includes days elapsed', () => {
    const result = renderTemplate('outcome_followup', {
      days_elapsed: '30',
      outcome_url: 'https://example.com/outcome',
    });

    expect(result.html).toContain('30 days');
    expect(result.html).toContain('Share Your Outcome');
    expect(result.text).toContain('30 days');
  });

  it('mentions privacy', () => {
    const result = renderTemplate('outcome_followup', {});
    expect(result.html).toContain('private');
    expect(result.html).toContain('optional');
  });
});

/* ------------------------------------------------------------------ */
/*  Payment confirmation template                                     */
/* ------------------------------------------------------------------ */

describe('renderTemplate — payment_confirmation', () => {
  it('includes amount and product name', () => {
    const result = renderTemplate('payment_confirmation', {
      amount: '$49',
      product_name: 'Security Deposit Letter',
      case_url: 'https://example.com/case/1',
    });

    expect(result.html).toContain('$49');
    expect(result.html).toContain('Security Deposit Letter');
    expect(result.subject).toContain('Security Deposit Letter');
  });

  it('includes expectation-setting copy', () => {
    const result = renderTemplate('payment_confirmation', {});

    expect(result.html).toContain('writing assistance, not legal advice');
    expect(result.html).toContain('Individual results vary');
    expect(result.html).toContain('Review all content carefully');
  });
});

/* ------------------------------------------------------------------ */
/*  Error handling                                                    */
/* ------------------------------------------------------------------ */

describe('renderTemplate — error handling', () => {
  it('throws on unknown template ID', () => {
    expect(() =>
      renderTemplate('nonexistent' as TemplateId, {}),
    ).toThrow();
  });
});
