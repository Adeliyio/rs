import { readFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');
const RULES_DIR = join(ROOT, 'rules');
const PROHIBITED_PHRASES_FILE = join(RULES_DIR, 'prohibited-phrases.md');

/** File extensions worth scanning. */
const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.json', '.md']);

// ---------------------------------------------------------------------------
// 1. Parse prohibited phrases from the markdown file
// ---------------------------------------------------------------------------

function extractPhrasesFromMarkdown(filePath: string): string[] {
  if (!existsSync(filePath)) {
    console.error(`ERROR: Prohibited phrases file not found: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  const phrases: string[] = [];
  let inCodeBlock = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock && trimmed.length > 0) {
      phrases.push(trimmed);
    }
  }

  return phrases;
}

// ---------------------------------------------------------------------------
// 2. Get staged files from git
// ---------------------------------------------------------------------------

/**
 * Returns the list of staged (--cached) files that are added or modified.
 * Only includes files with scannable extensions. Deleted files are excluded
 * since there is nothing to scan.
 */
function getStagedFiles(): string[] {
  let output: string;
  try {
    // --diff-filter=d excludes deleted files
    output = execSync('git diff --cached --name-only --diff-filter=d', {
      cwd: ROOT,
      encoding: 'utf-8',
    });
  } catch {
    // If git fails (e.g. not a repo), fall back to empty list
    console.warn('Warning: could not run git diff. No files scanned.');
    return [];
  }

  return output
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => {
      if (!f) return false;
      const ext = extname(f).toLowerCase();
      return SCANNABLE_EXTENSIONS.has(ext);
    });
}

// ---------------------------------------------------------------------------
// 3. Get only the added/changed lines for a staged file
// ---------------------------------------------------------------------------

/**
 * Returns only the newly added lines (lines starting with "+") from
 * the staged diff of a file. This ensures pre-existing content that
 * was already committed is never flagged — only new additions.
 *
 * Each entry includes the line number in the new file and the text.
 */
function getStagedAddedLines(
  relPath: string,
): { lineNumber: number; text: string }[] {
  let diff: string;
  try {
    diff = execSync(`git diff --cached -U0 -- "${relPath}"`, {
      cwd: ROOT,
      encoding: 'utf-8',
    });
  } catch {
    return [];
  }

  const results: { lineNumber: number; text: string }[] = [];
  let currentLineNumber = 0;

  for (const line of diff.split('\n')) {
    // Parse hunk header: @@ -old,count +new,count @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLineNumber = parseInt(hunkMatch[1]!, 10);
      continue;
    }

    // Added lines start with "+"  (but not "+++" which is the file header)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      results.push({
        lineNumber: currentLineNumber,
        text: line.slice(1), // Remove the leading "+"
      });
      currentLineNumber++;
      continue;
    }

    // Context lines (no prefix) also advance the line counter
    if (!line.startsWith('-') && !line.startsWith('\\')) {
      currentLineNumber++;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 4. Scan added lines for prohibited phrases
// ---------------------------------------------------------------------------

interface Match {
  file: string;
  line: number;
  phrase: string;
  text: string;
}

function scanAddedLines(
  relPath: string,
  addedLines: { lineNumber: number; text: string }[],
  phrases: string[],
): Match[] {
  const matches: Match[] = [];

  // Exclude the rules directory itself
  if (relPath.startsWith('rules')) return matches;

  // Exclude test files
  const lowerPath = relPath.toLowerCase();
  if (
    lowerPath.includes('.test.') ||
    lowerPath.includes('.spec.') ||
    lowerPath.includes('__tests__')
  ) {
    return matches;
  }

  for (const { lineNumber, text } of addedLines) {
    const textLower = text.toLowerCase();

    for (const phrase of phrases) {
      if (textLower.includes(phrase.toLowerCase())) {
        matches.push({
          file: relPath,
          line: lineNumber,
          phrase,
          text: text.trim(),
        });
      }
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Scanning for prohibited phrases...');
console.log('');

const phrases = extractPhrasesFromMarkdown(PROHIBITED_PHRASES_FILE);
console.log(`Loaded ${phrases.length} prohibited phrases from ${relative(ROOT, PROHIBITED_PHRASES_FILE)}`);

const stagedFiles = getStagedFiles();
console.log(`Scanning ${stagedFiles.length} staged file(s)...`);
console.log('');

if (stagedFiles.length === 0) {
  console.log('No staged files to scan.');
  process.exit(0);
}

const allMatches: Match[] = [];

for (const relPath of stagedFiles) {
  const addedLines = getStagedAddedLines(relPath);
  if (addedLines.length === 0) continue;

  const matches = scanAddedLines(relPath, addedLines, phrases);
  allMatches.push(...matches);
}

if (allMatches.length > 0) {
  console.error('Prohibited phrases found in newly added lines:');
  console.error('');

  for (const match of allMatches) {
    console.error(`  ${match.file}:${match.line} - "${match.phrase}"`);
    console.error(`    ${match.text}`);
    console.error('');
  }

  console.error(`Total: ${allMatches.length} match(es) in ${new Set(allMatches.map((m) => m.file)).size} file(s)`);
  console.error('');
  console.error('If these phrases are intentional (e.g. disclaimers, AI prompt deny-lists),');
  console.error('review carefully and re-commit with --no-verify if appropriate.');
  process.exit(1);
} else {
  console.log('No prohibited phrases found in staged changes.');
  process.exit(0);
}
