import { describe, it, expect } from 'vitest';

import { scanCompliance } from './compliance-scanner';
import { maskUserValues, maskUserValuesReversible } from './user-value-mask';

/**
 * Regression guard: a customer's own landlord name must never brick their
 * paid letter.
 *
 * The compliance scanner matches bare words — 'guarantee', 'guaranteed',
 * 'leverage' — case-insensitively on space boundaries. The deposit prompt
 * REQUIRES the letter to address the landlord by name and to reproduce the
 * user's deduction descriptions verbatim. So a tenant whose landlord is
 * "Guaranteed Rate Property Management" (a real national brand) failed the scan
 * on their own data. The strict retry could not help — no prompt change removes
 * a name the prompt mandates — so generation hard-failed twice and the $49
 * customer was auto-refunded with no letter.
 *
 * The rule this locks in: SCAN ONLY WHAT WE AUTHORED.
 *
 * The fixtures are production-shaped — a real letter body mixing our prose with
 * the user's verbatim text, not an isolated phrase.
 */

/** Real-world business names that collide with the prohibited-phrase list. */
const LANDLORD = 'Guaranteed Rate Property Management';
const DEDUCTION_A = 'Guarantee Carpet Cleaning';
const DEDUCTION_B = 'Leverage Painting Services';

const USER_VALUES = [LANDLORD, DEDUCTION_A, DEDUCTION_B];

const LETTER = `${LANDLORD}
500 Market St, San Francisco, CA 94105

RE: Demand for Return of Security Deposit

Under Cal. Civ. Code §1950.5, you were required to return the deposit within 21 days.
I dispute the following deductions:
- ${DEDUCTION_A}: $450
- ${DEDUCTION_B}: $800

Please remit $2,400 within 14 days.`;

describe('user-value masking protects the paid deliverable', () => {
  it('proves the bug: an innocent landlord name fails the raw scan', () => {
    const raw = scanCompliance(LETTER);
    expect(raw.pass).toBe(false);
    expect(raw.violations.length).toBeGreaterThan(0);
  });

  it('passes the same letter once the user values are masked', () => {
    const masked = scanCompliance(maskUserValues(LETTER, USER_VALUES));
    expect(masked.pass).toBe(true);
    expect(masked.violations).toHaveLength(0);
  });

  it('STILL catches prohibited language that WE authored', () => {
    // The whole point of the scanner. Masking must not become a bypass.
    const ours = scanCompliance(
      maskUserValues(
        'We guarantee you will win your case and recover your deposit.',
        USER_VALUES,
      ),
    );
    expect(ours.pass).toBe(false);
    expect(ours.violations.length).toBeGreaterThan(0);
  });

  it('does not mask trivially short values that would blank real text', () => {
    // A 1-2 char "value" would match everywhere; it must be ignored.
    const out = maskUserValues('The deposit was withheld in full.', ['a', 'in']);
    expect(out).toBe('The deposit was withheld in full.');
  });
});

describe('reversible masking restores the user text verbatim', () => {
  it('round-trips the exact user values into the delivered letter', () => {
    const { masked, restore } = maskUserValuesReversible(LETTER, USER_VALUES);

    // While masked, the user's colliding words are genuinely gone.
    expect(masked).not.toContain(LANDLORD);
    expect(masked).not.toContain(DEDUCTION_A);

    // ...and the customer's letter is byte-identical after restore.
    expect(restore(masked)).toBe(LETTER);
  });

  it('uses a sentinel the citation validator will not mistake for a citation', () => {
    const { masked } = maskUserValuesReversible(LETTER, USER_VALUES);
    // No section symbol, no digits-after-Code shape.
    expect(masked).toMatch(/XUSERVALUEX\d+X/);
    expect(masked).not.toMatch(/§\s*XUSERVALUEX/);
  });

  it('restores correctly even when a value appears more than once', () => {
    const text = `${LANDLORD} owes the deposit. Contact ${LANDLORD} directly.`;
    const { masked, restore } = maskUserValuesReversible(text, USER_VALUES);
    expect(masked).not.toContain(LANDLORD);
    expect(restore(masked)).toBe(text);
  });
});
