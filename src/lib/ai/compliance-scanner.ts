/**
 * Compliance scanner — server-only.
 *
 * Scans generated text for prohibited phrases that cross the UPL
 * (unauthorized practice of law) boundary or make impermissible
 * outcome predictions. The phrase list mirrors rules/prohibited-phrases.md.
 */

import type {
  ComplianceViolation,
  ComplianceScanResult,
} from '@/types/generation.types';

/* ------------------------------------------------------------------ */
/*  Prohibited phrases with optional replacements                     */
/* ------------------------------------------------------------------ */

interface ProhibitedEntry {
  phrase: string;
  replacement?: string;
}

/**
 * Hardcoded prohibited phrases matching the categories in
 * rules/prohibited-phrases.md. Grouped for clarity but flattened
 * at runtime. Case-insensitive matching is performed.
 */
const PROHIBITED_PHRASES: ProhibitedEntry[] = [
  /* Category 1: Legal Advice / Evaluative Language */
  { phrase: 'you should', replacement: 'a common approach is' },
  { phrase: 'i recommend', replacement: 'a common step is' },
  { phrase: 'we recommend', replacement: 'a common step is' },
  { phrase: 'we advise' },
  { phrase: 'you are entitled', replacement: 'the statute provides for' },
  { phrase: 'your rights', replacement: 'the applicable consumer protections' },
  { phrase: 'you have a case' },
  { phrase: 'you have a strong case' },
  { phrase: 'you have a claim' },
  { phrase: 'your claim is valid' },
  { phrase: 'your claim is strong' },
  { phrase: 'legal advice' },
  { phrase: 'this constitutes legal advice' },
  { phrase: 'as your attorney' },
  { phrase: 'our legal team' },
  { phrase: 'your legal team' },
  { phrase: 'in our legal opinion' },

  /* Category 2: Case Strength / Outcome Predictions */
  { phrase: 'strong case' },
  { phrase: 'weak case' },
  { phrase: 'likely to win' },
  { phrase: 'likely to recover' },
  { phrase: 'will recover' },
  { phrase: 'will win' },
  { phrase: 'guaranteed' },
  { phrase: 'guarantee' },
  { phrase: 'success rate' },
  { phrase: 'win rate' },
  { phrase: 'recovery rate' },
  { phrase: 'probability of' },
  { phrase: 'likelihood of' },
  { phrase: 'chances of' },
  { phrase: 'leverage' },
  { phrase: 'your position is strong' },
  { phrase: 'your position is weak' },
  { phrase: 'you will prevail' },
  { phrase: 'case strength' },
  { phrase: 'case score' },
  { phrase: 'merit score' },
  { phrase: 'success-probability' },
  { phrase: 'leverage indicator' },
  { phrase: "we'll handle it" },
  { phrase: 'leave it to us' },

  /* Category 3: Identity Claims */
  { phrase: 'robot lawyer' },
  { phrase: 'ai lawyer' },
  { phrase: 'ai attorney' },
  { phrase: 'ai legal team' },
  { phrase: 'artificial intelligence lawyer' },
  { phrase: 'virtual lawyer' },
  { phrase: 'digital attorney' },
  { phrase: 'your lawyer' },
  { phrase: 'your attorney' },
  { phrase: 'legal representation' },
  { phrase: 'we represent you' },
  { phrase: 'representing you' },
  { phrase: 'on your behalf' },
  { phrase: 'legal counsel' },
  { phrase: 'your counsel' },

  /* Category 4: Outcome Guarantees */
  { phrase: 'guaranteed recovery' },
  { phrase: 'guaranteed refund' },
  { phrase: 'guaranteed results' },
  { phrase: '100% success' },
  { phrase: 'always works' },
  { phrase: 'never fails' },
  { phrase: 'win every time' },
  { phrase: 'recover your money guaranteed' },
  { phrase: 'get your money back guaranteed' },

  /* Category 5: Directive Language (subset that may appear in generation) */
  { phrase: 'you need to send', replacement: 'a common next step is to send' },
  { phrase: 'you must act by', replacement: 'the statutory deadline is' },
  { phrase: 'demand your deposit back', replacement: 'request return of the deposit citing the applicable statute' },
  { phrase: 'take legal action', replacement: 'a common escalation step is' },
];

/* ------------------------------------------------------------------ */
/*  Scanner                                                           */
/* ------------------------------------------------------------------ */

/**
 * Scans the provided text for prohibited phrases.
 *
 * Performs case-insensitive matching. Returns all violations found,
 * with position (character offset) and optional suggested replacement.
 *
 * pass = true only if zero violations are found.
 */
export function scanCompliance(text: string): ComplianceScanResult {
  const violations: ComplianceViolation[] = [];
  const lowerText = text.toLowerCase();

  for (const entry of PROHIBITED_PHRASES) {
    const lowerPhrase = entry.phrase.toLowerCase();
    let searchStart = 0;

    // Find all occurrences of this phrase
    while (true) {
      const position = lowerText.indexOf(lowerPhrase, searchStart);
      if (position === -1) break;

      // Verify word boundaries to avoid false positives
      // (e.g., "guarantee" inside "no-guarantee" is still a match,
      //  but we want to avoid matching inside unrelated words)
      const charBefore = position > 0 ? lowerText[position - 1] : ' ';
      const charAfter =
        position + lowerPhrase.length < lowerText.length
          ? lowerText[position + lowerPhrase.length]
          : ' ';

      const isWordBoundaryBefore = /[\s.,;:!?'"()\-/[\]{}]/.test(charBefore ?? ' ');
      const isWordBoundaryAfter = /[\s.,;:!?'"()\-/[\]{}]/.test(charAfter ?? ' ');

      if (isWordBoundaryBefore && isWordBoundaryAfter) {
        violations.push({
          phrase: text.slice(position, position + entry.phrase.length),
          position,
          suggested_replacement: entry.replacement,
        });
      }

      searchStart = position + lowerPhrase.length;
    }
  }

  // Sort violations by position for predictable ordering
  violations.sort((a, b) => a.position - b.position);

  return {
    violations,
    pass: violations.length === 0,
  };
}
