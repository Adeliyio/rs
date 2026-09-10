import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { validateCitations } from './citation-validator';
import type { Statute } from '@/types/kb.types';

/**
 * Regression guard for the public promise:
 *   "If a citation can't be verified, the letter doesn't ship."
 *
 * Two independent defects made that promise false, and they compounded:
 *
 *  1. FAIL-OPEN THRESHOLD. `pass` was `stripped.length <= 2`, so a letter
 *     shipped with up to TWO citations already detected as ungrounded.
 *     Stripping removes only the citation STRING — the sentence built around it
 *     survives, so the customer mailed "Under Tex. Prop. Code a landlord who
 *     fails to comply is liable for double the amount withheld." A false
 *     statement of law with the citation that would disprove it deleted.
 *
 *  2. EXTRACTION BLIND SPOT (the inert-fix shape). Every pattern required a
 *     literal `§`, or `Code`/`Stat.` immediately before the digits. The
 *     grounding check itself was strong and would pass any reviewer — but
 *     prose-form citations were never handed to it, so "Section 92.108 of the
 *     Texas Property Code" shipped with pass:true and ZERO stripped.
 *
 * These fixtures use PRODUCTION-SHAPED grounding: the real TX knowledge-base
 * entry, loaded from disk, in the real (statute_id, citation, title,
 * key_provisions) shape. A hand-built mock is what let this stay green.
 */

const txKb = JSON.parse(
  readFileSync(join(process.cwd(), 'kb', 'deposit', 'TX', 'kb-entry.json'), 'utf-8'),
) as { statutes: Statute[] };

const STATUTES = txKb.statutes;
const GROUNDING_IDS = STATUTES.map((s) => s.statute_id);

/** §92.108 does not exist in the TX KB — every fabrication below uses it. */
const FABRICATED = '92.108';

describe('citation validator fails closed on any ungrounded citation', () => {
  it('sanity: the KB really does not ground the fabricated section', () => {
    expect(GROUNDING_IDS.some((id) => id.includes(FABRICATED))).toBe(false);
    // ...and really does ground the genuine one we use as the control.
    expect(GROUNDING_IDS.some((id) => id.includes('92.103'))).toBe(true);
  });

  it('passes a letter whose citations are all grounded', () => {
    const { result } = validateCitations(
      'Under Tex. Prop. Code §92.103, the deposit must be refunded within 30 days.',
      GROUNDING_IDS,
      STATUTES,
    );
    expect(result.pass).toBe(true);
    expect(result.stripped).toHaveLength(0);
    expect(result.valid.length).toBeGreaterThan(0);
  });

  it('BLOCKS a single fabricated §-form citation (was: shipped, up to 2 allowed)', () => {
    const { result } = validateCitations(
      `Under Tex. Prop. Code §92.103, the deposit must be refunded. ` +
        `Under Tex. Prop. Code §${FABRICATED}, a landlord is liable for double the amount withheld.`,
      GROUNDING_IDS,
      STATUTES,
    );
    expect(result.stripped.length).toBeGreaterThan(0);
    expect(result.pass).toBe(false);
  });

  it('EXTRACTS AND BLOCKS a prose-form citation (was: never extracted at all)', () => {
    const { result } = validateCitations(
      `Under Section ${FABRICATED} of the Texas Property Code, a landlord is liable ` +
        `for double the amount withheld. Under Tex. Prop. Code §92.103, the deposit must be refunded.`,
      GROUNDING_IDS,
      STATUTES,
    );
    // The decisive assertion: the fabrication must be SEEN, not merely unmatched.
    expect(result.stripped.length).toBeGreaterThan(0);
    expect(result.pass).toBe(false);
  });

  it('EXTRACTS AND BLOCKS a "Code Ann." citation (was: never extracted at all)', () => {
    const { result } = validateCitations(
      `Under Tex. Prop. Code Ann. ${FABRICATED}, the landlord owes double damages. ` +
        `Under Tex. Prop. Code §92.103, the deposit must be refunded.`,
      GROUNDING_IDS,
      STATUTES,
    );
    expect(result.stripped.length).toBeGreaterThan(0);
    expect(result.pass).toBe(false);
  });

  it('does not ship a letter that has no grounded citation at all', () => {
    const { result } = validateCitations(
      'Your landlord owes you the deposit back.',
      GROUNDING_IDS,
      STATUTES,
    );
    expect(result.pass).toBe(false);
  });

  it('rejects out-of-state law in a Texas letter', () => {
    const { result } = validateCitations(
      'Under Cal. Civ. Code §1950.5, the deposit must be returned within 21 days. ' +
        'Under Tex. Prop. Code §92.103, the deposit must be refunded.',
      GROUNDING_IDS,
      STATUTES,
    );
    expect(result.pass).toBe(false);
  });
});
