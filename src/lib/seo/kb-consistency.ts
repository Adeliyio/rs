/**
 * SEO-config ↔ KB consistency check.
 *
 * The KB (kb/deposit/{STATE}/kb-entry.json) is the single legal-fact authority:
 * it is what the weekly law-monitor worker re-verifies against live government
 * sources. The SEO config (src/lib/seo/config.ts) restates a few of those facts
 * — the return-deadline, the small-claims limit, the statute citation — as
 * marketing copy on the /deposit/{state} and /deposit/{state}/{county} pages.
 *
 * Two copies of a fact drift. This module makes the SEO copy PROVABLY track the
 * KB: it compares the two and returns every mismatch. It is run in two places so
 * a drift can never ship:
 *   - `scripts/validate-kb.ts` (CI, blocks the deploy), and
 *   - `src/lib/seo/__tests__/kb-consistency.test.ts` (local `vitest`).
 *
 * When the law monitor flags a KB change and an admin updates the KB, this check
 * forces the SEO page to be updated in the same PR — closing the loop the
 * monitor opened.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { JURISDICTIONS, type SeoJurisdiction } from './config';

export interface ConsistencyMismatch {
  jurisdiction: string; // "FL"
  field: string; // "smallClaimsLimit"
  seoValue: string;
  kbValue: string;
  detail: string;
}

/** Collapse all whitespace and lowercase — citation formats vary (§ 1950.5 vs §1950.5). */
function normalizeCitation(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

/** Parse a human dollar string ("$10,000", "$10,000 (NYC)") to a number. */
function parseDollars(s: string): number | null {
  const m = /\$?(\d+)/.exec(s.replace(/,/g, ''));
  return m ? Number(m[1]) : null;
}

/** Minimal shape we read from a KB entry — the file has much more. */
interface KbEntryFacts {
  statutes: { citation: string }[];
  deadline_rules: {
    statute_id: string;
    deadline_days: number;
    anchor_event: string;
    is_statutory: boolean;
  }[];
  escalation_venues: { type: string; monetary_limit?: number }[];
}

function loadKbFacts(stateCode: string): KbEntryFacts {
  const path = join(process.cwd(), 'kb', 'deposit', stateCode, 'kb-entry.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as KbEntryFacts;
}

/**
 * Compare one SEO jurisdiction against its KB entry. Returns [] when consistent.
 */
export function checkJurisdiction(j: SeoJurisdiction): ConsistencyMismatch[] {
  const mismatches: ConsistencyMismatch[] = [];
  let kb: KbEntryFacts;
  try {
    kb = loadKbFacts(j.code);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return [{
      jurisdiction: j.code,
      field: 'kb-entry',
      seoValue: j.page.path,
      kbValue: '(missing)',
      detail: `Could not load KB entry for ${j.code}: ${detail}`,
    }];
  }

  /* --- return deadline: SEO days vs the statutory move-out deadline rule --- */
  const returnRule = kb.deadline_rules.find(
    (r) => r.anchor_event === 'move_out' && r.is_statutory,
  );
  if (!returnRule) {
    mismatches.push({
      jurisdiction: j.code,
      field: 'returnDeadlineDays',
      seoValue: String(j.returnDeadlineDays),
      kbValue: '(no statutory move_out rule)',
      detail: `KB has no statutory move_out deadline rule for ${j.code}.`,
    });
  } else if (returnRule.deadline_days !== j.returnDeadlineDays) {
    mismatches.push({
      jurisdiction: j.code,
      field: 'returnDeadlineDays',
      seoValue: String(j.returnDeadlineDays),
      kbValue: String(returnRule.deadline_days),
      detail: `SEO return deadline (${j.returnDeadlineDays}d) != KB statutory deadline (${returnRule.deadline_days}d).`,
    });
  }

  /* --- small-claims limit: SEO dollars vs KB small_claims venue limit --- */
  const scVenue = kb.escalation_venues.find(
    (v) => v.type === 'small_claims' && typeof v.monetary_limit === 'number',
  );
  const seoLimit = parseDollars(j.smallClaimsLimit);
  if (scVenue?.monetary_limit != null && seoLimit != null) {
    if (scVenue.monetary_limit !== seoLimit) {
      mismatches.push({
        jurisdiction: j.code,
        field: 'smallClaimsLimit',
        seoValue: j.smallClaimsLimit,
        kbValue: `$${scVenue.monetary_limit.toLocaleString()}`,
        detail: `SEO small-claims limit (${j.smallClaimsLimit}) != KB monetary_limit ($${scVenue.monetary_limit}).`,
      });
    }
  } else {
    mismatches.push({
      jurisdiction: j.code,
      field: 'smallClaimsLimit',
      seoValue: j.smallClaimsLimit,
      kbValue: scVenue ? String(scVenue.monetary_limit) : '(no small_claims venue)',
      detail: `Could not compare small-claims limit for ${j.code} (unparseable SEO value or missing KB venue).`,
    });
  }

  /* --- statute citation: SEO must match SOME KB statute (format-insensitive) --- */
  const seoCite = normalizeCitation(j.statuteCitation);
  const kbCites = kb.statutes.map((s) => normalizeCitation(s.citation));
  // A prefix match handles "§92.103" appearing where SEO cites the chapter-level
  // "§92.103" but KB lists "§92.101" as statute[0]; require an exact normalized
  // match against at least one KB statute citation.
  if (!kbCites.includes(seoCite)) {
    mismatches.push({
      jurisdiction: j.code,
      field: 'statuteCitation',
      seoValue: j.statuteCitation,
      kbValue: kb.statutes.map((s) => s.citation).join(' | '),
      detail: `SEO statute citation "${j.statuteCitation}" matches no KB statute for ${j.code}.`,
    });
  }

  return mismatches;
}

/** Check every SEO jurisdiction against its KB entry. Returns all mismatches. */
export function checkAllJurisdictions(): ConsistencyMismatch[] {
  return JURISDICTIONS.flatMap((j) => checkJurisdiction(j));
}
