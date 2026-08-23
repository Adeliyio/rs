import { describe, it, expect } from 'vitest';

import { checkAllJurisdictions, checkJurisdiction } from '../kb-consistency';
import { JURISDICTIONS } from '../config';

/**
 * The SEO ↔ KB drift guard. The KB is the legal-fact authority the law monitor
 * re-verifies weekly; these SEO facts must track it. If someone updates the KB
 * (e.g. after a monitor alert) but forgets the SEO page — or vice versa — this
 * fails here rather than shipping two contradictory numbers to search engines.
 */

describe('SEO config tracks the KB (single legal-fact authority)', () => {
  it('has no fact mismatches across all jurisdictions', () => {
    const mismatches = checkAllJurisdictions();
    // Surface every mismatch in the failure message, not just the count.
    expect(mismatches, mismatches.map((m) => m.detail).join('\n')).toEqual([]);
  });

  for (const j of JURISDICTIONS) {
    it(`${j.code}: return deadline, small-claims limit, and citation match the KB`, () => {
      expect(checkJurisdiction(j)).toEqual([]);
    });
  }
});
