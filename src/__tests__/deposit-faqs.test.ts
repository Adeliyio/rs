/**
 * Deposit FAQ content — integrity
 *
 * The per-state FAQ blocks feed AI Overviews / "People Also Ask" and are the
 * on-page answers to the highest-volume deposit queries. This guards that every
 * supported state has substantive, on-topic FAQ copy that stays consistent with
 * the statute facts in the jurisdiction config.
 */

import { describe, it, expect } from 'vitest';

import { DEPOSIT_FAQS } from '@/lib/seo/deposit-faqs';
import { DEPOSIT_JURISDICTION } from '@/types/enums';
import { JURISDICTIONS } from '@/lib/seo/config';

describe('deposit FAQs — coverage', () => {
  it('every supported state has a FAQ set', () => {
    for (const code of DEPOSIT_JURISDICTION) {
      expect(DEPOSIT_FAQS[code], `missing FAQs for ${code}`).toBeDefined();
      expect((DEPOSIT_FAQS[code] ?? []).length, `${code} FAQ count`).toBeGreaterThanOrEqual(5);
    }
  });

  it('has no FAQ sets for unsupported states', () => {
    const extra = Object.keys(DEPOSIT_FAQS).filter(
      (c) => !DEPOSIT_JURISDICTION.includes(c as never),
    );
    expect(extra, `unexpected FAQ states: ${extra.join(', ')}`).toEqual([]);
  });
});

describe('deposit FAQs — quality', () => {
  it('every entry has a real question and a substantive answer', () => {
    for (const [code, faqs] of Object.entries(DEPOSIT_FAQS)) {
      for (const faq of faqs) {
        expect(faq.question.trim().endsWith('?'), `${code}: "${faq.question}" not a question`).toBe(true);
        expect(faq.answer.length, `${code}: answer too short for "${faq.question}"`).toBeGreaterThan(60);
      }
    }
  });

  it('every state answers the deadline and the small-claims-amount intents', () => {
    for (const [code, faqs] of Object.entries(DEPOSIT_FAQS)) {
      const text = faqs.map((f) => f.question.toLowerCase()).join(' | ');
      expect(text, `${code} missing a deadline question`).toMatch(/how long|deadline|missed/);
      expect(text, `${code} missing a sue/small-claims question`).toMatch(/sue|recover|small claims/);
    }
  });

  it('each FAQ set cites its state statute somewhere', () => {
    for (const code of DEPOSIT_JURISDICTION) {
      const j = JURISDICTIONS.find((x) => x.code === code);
      // The statute number (e.g. "1950.5", "92.103") should appear in the copy.
      const num = (j?.statuteCitation ?? '').match(/[\d.-]+\d/)?.[0] ?? '';
      const body = (DEPOSIT_FAQS[code] ?? []).map((f) => f.answer).join(' ');
      expect(num.length, `${code} has no statute number to check`).toBeGreaterThan(0);
      expect(body.includes(num), `${code} FAQs never cite statute ${num}`).toBe(true);
    }
  });
});
