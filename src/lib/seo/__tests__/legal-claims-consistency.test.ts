import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * Guards the strongest public statements of law against the knowledge base.
 *
 * The homepage rendered a sample Texas letter claiming a landlord "who fails to
 * return the deposit or provide an itemized accounting may be liable for $100
 * plus three times the amount wrongfully withheld". The company's own KB says
 * the remedy requires a landlord who "in bad faith retains" the deposit
 * (§92.109) — and that the 30-day clock does not even start until the tenant
 * gives a WRITTEN forwarding address (§92.103/§92.107). The marketing copy had
 * converted a fault-based remedy into strict liability and dropped a
 * precondition the KB flags as critical, overstating what a Texas tenant is
 * likely owed — under a banner promising validation against primary sources.
 *
 * The existing kb-consistency check compares only three numeric fields against
 * one config file, so the strongest legal claims on the site were the ones
 * nothing covered.
 *
 * These assertions read BOTH sides from disk, so drift in either the copy or
 * the KB fails the build rather than waiting for an audit.
 */

function readSource(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), 'utf-8');
}

interface KbStatute {
  statute_id: string;
  citation: string;
  summary: string;
}
interface KbPenalty {
  statute_id: string;
  conditions?: string;
}
interface KbEntry {
  statutes: KbStatute[];
  penalties?: KbPenalty[];
}

const TX_KB = JSON.parse(
  readSource('kb', 'deposit', 'TX', 'kb-entry.json'),
) as KbEntry;

const HOMEPAGE = readSource('src', 'app', 'page.tsx');
const TX_PAGE = readSource(
  'src',
  'app',
  '(marketing)',
  'deposit',
  'texas',
  'page.tsx',
);

/**
 * The Texas sample letter quote rendered on the homepage — the RENDERED STRING
 * only.
 *
 * Deliberately extracts the quoted literal rather than slicing a window around
 * a marker. An earlier version of this helper anchored on the bare text
 * "92.109", which matched a source COMMENT sitting above the quote — so the
 * assertions were validating a comment rather than the copy users read, and
 * passed even when the quote itself was reverted to the false claim. A guard
 * that passes for the wrong reason is worse than no guard.
 */
function homepageTexasQuote(): string {
  // Match the single-quoted string literal that opens with the §92.103 cite.
  // The source escapes the section symbol as a § sequence.
  const match = HOMEPAGE.match(
    /'Under Tex\. Prop\. Code[^']*92\.109[^']*'/,
  );
  expect(match).not.toBeNull();
  return match![0];
}

describe('KB is the source of truth for the Texas remedy', () => {
  it('sanity: the KB itself conditions §92.109 on bad faith', () => {
    const statute = TX_KB.statutes.find((s) => s.statute_id.includes('92.109'));
    expect(statute).toBeDefined();
    expect(statute!.summary.toLowerCase()).toContain('bad faith');

    const penalty = TX_KB.penalties?.find((p) =>
      p.statute_id.includes('92.109'),
    );
    expect(penalty?.conditions?.toLowerCase()).toContain('bad faith');
  });

  it('sanity: the KB conditions the §92.103 clock on a written forwarding address', () => {
    const statute = TX_KB.statutes.find((s) => s.statute_id.includes('92.103'));
    expect(statute).toBeDefined();
    expect(statute!.summary.toLowerCase()).toContain('forwarding address');
  });
});

describe('homepage Texas sample letter matches the KB', () => {
  it('states the bad-faith element of the 3x remedy', () => {
    expect(homepageTexasQuote().toLowerCase()).toContain('bad faith');
  });

  it('states the written-forwarding-address precondition', () => {
    expect(homepageTexasQuote().toLowerCase()).toContain('forwarding address');
  });

  it('does not present the remedy as strict liability', () => {
    // The exact phrasing that made the claim false.
    expect(homepageTexasQuote()).not.toContain(
      'a landlord who fails to return the deposit or provide an itemized accounting may be liable',
    );
  });
});

describe('Texas state marketing page matches the KB', () => {
  it('conditions the penalty note on bad faith', () => {
    const start = TX_PAGE.indexOf('penaltyNote');
    expect(start).toBeGreaterThan(-1);
    expect(TX_PAGE.slice(start, start + 300).toLowerCase()).toContain(
      'bad-faith',
    );
  });

  it('states the written-forwarding-address precondition in the summary', () => {
    const start = TX_PAGE.indexOf('statuteSummary');
    expect(start).toBeGreaterThan(-1);
    expect(TX_PAGE.slice(start, start + 400).toLowerCase()).toContain(
      'forwarding address',
    );
  });
});

describe('California copy keeps its own bad-faith qualifier', () => {
  it('still qualifies the 2x remedy', () => {
    const page = readSource(
      'src',
      'app',
      '(marketing)',
      'deposit',
      'california',
      'page.tsx',
    );
    const start = page.indexOf('penaltyNote');
    expect(start).toBeGreaterThan(-1);
    expect(page.slice(start, start + 300).toLowerCase()).toContain('bad-faith');
  });
});
