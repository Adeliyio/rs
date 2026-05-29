/**
 * Post-generation citation validator — server-only.
 *
 * Extracts all citation-like patterns from generated text and validates
 * each against the grounding context. Ungrounded citations are stripped
 * from the text. This is a conservative validator: if we cannot confirm
 * a citation is grounded, it gets removed.
 */

import type { Citation, CitationValidationResult } from '@/types/generation.types';
import type { Statute } from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Citation extraction patterns                                      */
/* ------------------------------------------------------------------ */

/**
 * Regex patterns that match common legal citation formats.
 * Each pattern captures the full citation string.
 */
const CITATION_PATTERNS: RegExp[] = [
  // Federal: 15 U.S.C. §1666, 16 CFR Part 425
  /\d{1,2}\s+U\.S\.C\.\s*§\s*\d+[\w.-]*/gi,
  /\d{1,2}\s+CFR\s+Part\s+\d+/gi,

  // Section symbol standalone: §1234, § 1234
  /§\s*\d+[\w.-]*/g,

  // California: Cal. Bus. & Prof. Code §17602, Cal. Civ. Code §1812.80
  /Cal\.\s+(?:Bus\.\s*&\s*Prof\.|Civ\.|Com\.|Corp\.|Educ\.|Gov't?\.|Health\s*&\s*Safety|Lab\.|Pen\.|Prob\.|Rev\.\s*&\s*Tax\.)\s+Code\s*§?\s*\d+[\w.-]*/gi,

  // New York: N.Y. Gen. Bus. Law §527-a, N.Y. GBL §620
  /N\.Y\.\s+(?:Gen\.\s*Bus\.\s*Law|GBL|CPLR|Exec\.\s*Law|Real\s*Prop\.\s*Law)\s*§?\s*\d+[\w.-]*/gi,

  // Texas: Tex. Occ. Code §702, Tex. Bus. & Com. Code
  /Tex\.\s+(?:Occ\.|Bus\.\s*&\s*Com\.|Prop\.|Gov't?\.|Fin\.|Health\s*&\s*Safety)\s+Code\s*§?\s*\d+[\w.-]*/gi,

  // Florida: Fla. Stat. §501.012
  /Fla\.\s+Stat\.\s*§?\s*\d+[\w.-]*/gi,

  // General state patterns with section
  /(?:Bus\.\s*&\s*Prof\.\s*Code|Gen\.\s*Bus\.\s*Law|GBL|Occ\.\s*Code)\s*§\s*\d+[\w.-]*/gi,

  // FTC-specific references
  /FTC\s+(?:Click-to-Cancel|Negative\s+Option)\s+Rule/gi,
  /FTC\s+Act\s*§?\s*\d*/gi,

  // ROSCA
  /Restore\s+Online\s+Shoppers['']?\s+Confidence\s+Act/gi,
  /ROSCA/g,

  // FCBA / Fair Credit Billing Act
  /Fair\s+Credit\s+Billing\s+Act/gi,
  /FCBA/g,
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Normalize a citation string for comparison: lowercase, collapse whitespace, strip punctuation */
function normalizeCitation(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:'"()[\]{}]/g, '')
    .trim();
}

/** Build a set of normalized reference strings from the grounding statutes */
function buildGroundingIndex(
  groundingStatuteIds: string[],
  kbStatutes: Statute[],
): Set<string> {
  const index = new Set<string>();

  // Add all statute_ids (normalized)
  for (const id of groundingStatuteIds) {
    index.add(normalizeCitation(id));
  }

  // Add all citation strings from KB statutes
  for (const statute of kbStatutes) {
    index.add(normalizeCitation(statute.statute_id));
    index.add(normalizeCitation(statute.citation));
    index.add(normalizeCitation(statute.title));

    // Add key provision subsections
    for (const prov of statute.key_provisions) {
      index.add(normalizeCitation(prov.subsection));
    }
  }

  return index;
}

/** Check whether a candidate citation is grounded against the index */
function isGrounded(
  candidate: string,
  groundingIndex: Set<string>,
): boolean {
  const normalized = normalizeCitation(candidate);

  // Direct match
  if (groundingIndex.has(normalized)) {
    return true;
  }

  // Check if any grounding entry contains the candidate or vice versa
  for (const entry of groundingIndex) {
    if (entry.includes(normalized) || normalized.includes(entry)) {
      return true;
    }
  }

  return false;
}

/** Deduplicate citation strings */
function deduplicateCitations(citations: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const c of citations) {
    const norm = normalizeCitation(c);
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(c);
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Validates all citations found in the text against the grounding context.
 *
 * Returns the validation result and a cleaned version of the text with
 * ungrounded citations stripped.
 *
 * @param text  The generated email body text.
 * @param groundingStatuteIds  Statute IDs from the grounding context.
 * @param kbStatutes  Full Statute objects for richer matching.
 * @returns  { result: CitationValidationResult, cleanedText: string }
 */
export function validateCitations(
  text: string,
  groundingStatuteIds: string[],
  kbStatutes: Statute[],
): { result: CitationValidationResult; cleanedText: string } {
  const groundingIndex = buildGroundingIndex(groundingStatuteIds, kbStatutes);

  // Extract all candidate citations from the text
  const candidateMatches: string[] = [];
  for (const pattern of CITATION_PATTERNS) {
    // Reset lastIndex since we reuse patterns
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match !== null) {
      candidateMatches.push(match[0]);
      match = pattern.exec(text);
    }
  }

  const uniqueCandidates = deduplicateCitations(candidateMatches);

  const valid: Citation[] = [];
  const stripped: Citation[] = [];

  for (const candidate of uniqueCandidates) {
    const grounded = isGrounded(candidate, groundingIndex);

    const citation: Citation = {
      statute_id: candidate,
      citation_text: candidate,
      is_grounded: grounded,
    };

    if (grounded) {
      valid.push(citation);
    } else {
      stripped.push(citation);
    }
  }

  // Strip ungrounded citations from text
  let cleanedText = text;
  for (const s of stripped) {
    // Remove the citation text, being careful not to leave dangling punctuation
    const escaped = s.citation_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const removalPattern = new RegExp(
      `\\s*(?:under|per|pursuant to|as required by|in accordance with|as provided by|citing|referencing)?\\s*(?:the\\s+)?${escaped}[.,;]?`,
      'gi',
    );
    cleanedText = cleanedText.replace(removalPattern, '');
  }

  // Clean up any double spaces or empty parentheses left behind
  cleanedText = cleanedText
    .replace(/\(\s*\)/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/\n /g, '\n')
    .trim();

  // pass = true if we stripped 2 or fewer AND at least 1 valid remains
  const pass = stripped.length <= 2 && valid.length > 0;

  return {
    result: { valid, stripped, pass },
    cleanedText,
  };
}
