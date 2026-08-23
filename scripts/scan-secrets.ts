import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');
const SRC_DIR = join(ROOT, 'src');

// ---------------------------------------------------------------------------
// Secret patterns to detect
// ---------------------------------------------------------------------------

interface SecretPattern {
  name: string;
  regex: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'Anthropic API key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'Stripe live key', regex: /sk_live_[A-Za-z0-9]{20,}/ },
  { name: 'Stripe test key', regex: /sk_test_[A-Za-z0-9]{20,}/ },
  { name: 'Resend API key', regex: /re_[A-Za-z0-9]{20,}/ },
  { name: 'Tavily API key', regex: /tvly-[A-Za-z0-9]{20,}/ },
  { name: 'Paddle key', regex: /pdl_[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI project key', regex: /sk-proj-[A-Za-z0-9_-]{20,}/ },
  { name: 'Long base64-encoded key', regex: /['"`][A-Za-z0-9+/=]{40,}['"`]/ },
];

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

/** File extensions considered non-binary and worth scanning. */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.txt', '.html', '.css', '.scss',
  '.sql', '.sh', '.env',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules', '.next', '.git', 'tiers',
]);

const EXCLUDED_FILES = new Set([
  '.env.example',
]);

function collectFiles(dir: string): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) return results;

  function walk(currentDir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);

      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry)) continue;
        walk(fullPath);
      } else if (stat.isFile()) {
        if (EXCLUDED_FILES.has(basename(fullPath))) continue;

        const ext = extname(entry).toLowerCase();
        // Also include extensionless files that might be config
        if (TEXT_EXTENSIONS.has(ext) || ext === '') {
          // Skip large files (>1MB likely binary or generated)
          if (stat.size <= 1_048_576) {
            results.push(fullPath);
          }
        }
      }
    }
  }

  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

interface SecretMatch {
  file: string;
  line: number;
  patternName: string;
  snippet: string;
}

function scanFile(filePath: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const relPath = relative(ROOT, filePath);

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return matches;
  }

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        // For the base64 pattern, apply additional heuristics to reduce false positives:
        // Skip lines that look like they're in package-lock, pnpm-lock, or are import statements
        if (pattern.name === 'Long base64-encoded key') {
          const trimmed = line.trim();
          if (
            trimmed.startsWith('//') ||
            trimmed.startsWith('*') ||
            trimmed.startsWith('import ') ||
            trimmed.startsWith('export ') ||
            // Skip hash-like values in lock files
            relPath.includes('lock.')
          ) {
            continue;
          }
        }

        // Mask the actual secret in the output
        const matchResult = pattern.regex.exec(line);
        const matched = matchResult ? matchResult[0] : '';
        const masked =
          matched.length > 8
            ? matched.substring(0, 8) + '...[REDACTED]'
            : '[REDACTED]';

        matches.push({
          file: relPath,
          line: i + 1,
          patternName: pattern.name,
          snippet: masked,
        });
      }
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// Determine files to scan: git staged files or all src/ files
// ---------------------------------------------------------------------------

function getFilesToScan(): string[] {
  // Try to get git staged files first
  try {
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const files = staged
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
      .map((f) => join(ROOT, f))
      .filter((f) => {
        const ext = extname(f).toLowerCase();
        return TEXT_EXTENSIONS.has(ext) || ext === '';
      })
      .filter((f) => !EXCLUDED_FILES.has(basename(f)))
      .filter((f) => existsSync(f));

    if (files.length > 0) {
      console.log(`Scanning ${files.length} git staged file(s)...`);
      return files;
    }
  } catch {
    // Not a git repo or git not available — fall through
  }

  // Fall back to scanning all src/ files
  console.log('No git staged files found. Scanning all src/ files...');
  return collectFiles(SRC_DIR);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Scanning for secrets...');
console.log('');

const files = getFilesToScan();
console.log(`${files.length} file(s) to scan`);
console.log('');

const allMatches: SecretMatch[] = [];

for (const file of files) {
  const matches = scanFile(file);
  allMatches.push(...matches);
}

if (allMatches.length > 0) {
  console.error('Potential secrets detected:');
  console.error('');

  for (const match of allMatches) {
    console.error(
      `  ${match.file}:${match.line} [${match.patternName}] ${match.snippet}`
    );
  }

  console.error('');
  console.error(
    `Total: ${allMatches.length} potential secret(s) in ${new Set(allMatches.map((m) => m.file)).size} file(s)`
  );
  console.error('');
  console.error('If these are false positives, consider:');
  console.error('  - Moving secrets to .env files (which are git-ignored)');
  console.error('  - Using environment variables instead of hardcoded values');
  process.exit(1);
} else {
  console.log('No secrets detected.');
  process.exit(0);
}
