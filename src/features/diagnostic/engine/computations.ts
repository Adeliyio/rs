/**
 * Evaluates `computed` type node expressions against the answers map.
 *
 * Supported computations:
 *   - days_between(field, 'today')  — calendar days between a date answer and today
 *   - sum(field1, field2)           — adds two numeric answers
 *   - equals(field, value)          — strict equality check
 *
 * Returns the computed result (number | boolean | string).
 */

/* ------------------------------------------------------------------ */
/*  Parser                                                            */
/* ------------------------------------------------------------------ */

interface ParsedCall {
  fn: string;
  args: string[];
}

function parseComputation(expression: string): ParsedCall | undefined {
  const match = /^(\w+)\((.+)\)$/.exec(expression.trim());
  if (!match) return undefined;

  const fn = match[1]!;
  const rawArgs = match[2]!;

  // Split on commas, trim whitespace and surrounding quotes
  const args = rawArgs.split(',').map((a) => {
    const trimmed = a.trim();
    // Strip surrounding single or double quotes
    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  });

  return { fn, args };
}

/* ------------------------------------------------------------------ */
/*  Resolvers                                                         */
/* ------------------------------------------------------------------ */

function resolveValue(key: string, answers: Record<string, unknown>): unknown {
  if (key === 'today') return new Date().toISOString().slice(0, 10);
  return answers[key];
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  const parsed = Number(val);
  if (Number.isNaN(parsed)) {
    throw new Error(`Cannot convert "${String(val)}" to number`);
  }
  return parsed;
}

function toDateMs(val: unknown): number {
  const str = String(val);
  const ms = new Date(str).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`Cannot parse date "${str}"`);
  }
  return ms;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 86_400_000;

export function evaluateComputation(
  computation: string,
  answers: Record<string, unknown>,
): unknown {
  const parsed = parseComputation(computation);
  if (!parsed) {
    throw new Error(`Invalid computation expression: "${computation}"`);
  }

  const { fn, args } = parsed;

  switch (fn) {
    case 'days_between': {
      const [fieldA, fieldB] = args as [string, string];
      if (!fieldA || !fieldB) {
        throw new Error('days_between requires two arguments');
      }
      const dateA = resolveValue(fieldA, answers);
      const dateB = resolveValue(fieldB, answers);
      const msA = toDateMs(dateA);
      const msB = toDateMs(dateB);
      return Math.abs(Math.round((msB - msA) / MS_PER_DAY));
    }

    case 'sum': {
      const [fA, fB] = args as [string, string];
      if (!fA || !fB) {
        throw new Error('sum requires two arguments');
      }
      const valA = resolveValue(fA, answers);
      const valB = resolveValue(fB, answers);
      return toNumber(valA) + toNumber(valB);
    }

    case 'equals': {
      const [field, expected] = args as [string, string];
      if (!field || expected === undefined) {
        throw new Error('equals requires two arguments');
      }
      const actual = resolveValue(field, answers);
      return String(actual) === expected;
    }

    default:
      throw new Error(`Unknown computation function: "${fn}"`);
  }
}
