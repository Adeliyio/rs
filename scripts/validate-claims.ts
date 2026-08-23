/**
 * Validates marketing page content against the approved claims library.
 *
 * Scans marketing-facing files (about page, landing pages) for:
 * 1. Prohibited variations of approved claims
 * 2. Absolute prohibitions from the claims library
 *
 * Run via: pnpm validate-claims
 * Part of the compliance pipeline (PRD §8.6).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');
const CLAIMS_FILE = join(ROOT, 'kb', 'compliance', 'approved-claims-library.json');

// ---------------------------------------------------------------------------
// 1. Load approved claims library
// ---------------------------------------------------------------------------

interface Claim {
  claim_id: string;
  category: string;
  claim: string;
  prohibited_variations: string[];
}

interface ClaimsLibrary {
  version: string;
  reviewed_by: string;
  claims: Claim[];
  absolute_prohibitions: string[];
}

if (!existsSync(CLAIMS_FILE)) {
  console.error(`ERROR: Approved claims library not found: ${CLAIMS_FILE}`);
  process.exit(1);
}

const library = JSON.parse(
  readFileSync(CLAIMS_FILE, 'utf-8'),
) as ClaimsLibrary;

console.log(`Loaded approved claims library v${library.version}`);
console.log(`  Reviewed by: ${library.reviewed_by}`);
console.log(`  ${library.claims.length} claims, ${library.absolute_prohibitions.length} absolute prohibitions`);
console.log('');

// ---------------------------------------------------------------------------
// 2. Collect prohibited phrases
// ---------------------------------------------------------------------------

const prohibitedPhrases: Array<{ phrase: string; source: string }> = [];

for (const claim of library.claims) {
  for (const pv of claim.prohibited_variations) {
    prohibitedPhrases.push({
      phrase: pv.toLowerCase(),
      source: `${claim.claim_id}: ${claim.category}`,
    });
  }
}

for (const ap of library.absolute_prohibitions) {
  prohibitedPhrases.push({
    phrase: ap.toLowerCase(),
    source: 'absolute_prohibition',
  });
}

console.log(`Checking ${prohibitedPhrases.length} prohibited phrases...`);

// ---------------------------------------------------------------------------
// 3. Scan marketing files
// ---------------------------------------------------------------------------

const MARKETING_FILES = [
  'src/app/about/page.tsx',
  'src/app/page.tsx',
  'src/app/deposit/page.tsx',
  'src/app/subscription/page.tsx',
  'src/components/dashboard/empty-state.tsx',
  'src/components/cookie-consent.tsx',
  'src/lib/email/templates.ts',
];

interface Violation {
  file: string;
  line: number;
  phrase: string;
  source: string;
  text: string;
}

const violations: Violation[] = [];

for (const relPath of MARKETING_FILES) {
  const fullPath = join(ROOT, relPath);
  if (!existsSync(fullPath)) continue;

  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i]!.toLowerCase();

    for (const { phrase, source } of prohibitedPhrases) {
      if (lineLower.includes(phrase)) {
        violations.push({
          file: relPath,
          line: i + 1,
          phrase,
          source,
          text: lines[i]!.trim(),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------

if (violations.length > 0) {
  console.error('');
  console.error('Prohibited claim variations found:');
  console.error('');

  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — "${v.phrase}"`);
    console.error(`    Source: ${v.source}`);
    console.error(`    Text: ${v.text}`);
    console.error('');
  }

  console.error(`Total: ${violations.length} violation(s)`);
  process.exit(1);
} else {
  console.log('No prohibited claim variations found.');
  process.exit(0);
}
