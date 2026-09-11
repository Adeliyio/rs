import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Guards the deposit-letter price floor and its live-test override.
 *
 * The floor is a SECURITY control: it is what stops an order for a cheap or
 * foreign Polar product from unlocking the $49 deliverable. `DEPOSIT_LETTER_MIN_CENTS`
 * exists so a $1 product can exercise the real checkout → webhook →
 * fulfillment path without spending $49 per run — which means a mistake here
 * makes the paid product free.
 *
 * The override must therefore be impossible to leave on by accident:
 *  - ignored when Polar is in production mode,
 *  - ignored unless a positive integer,
 *  - can only LOWER the floor, never raise it,
 *  - loud in logs whenever it applies.
 *
 * The helper is module-private, so these tests replicate its exact logic and
 * pin the production source to it.
 */

const DEFAULT_MIN = 4900;

/** Mirrors minDepositLetterCents() in webhook-processor.ts. */
function minDepositLetterCents(): number {
  const raw = process.env.DEPOSIT_LETTER_MIN_CENTS;
  if (!raw) return DEFAULT_MIN;
  if (process.env.POLAR_SERVER === 'production') return DEFAULT_MIN;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_MIN;
  return Math.min(parsed, DEFAULT_MIN);
}

const ORIGINAL_MIN = process.env.DEPOSIT_LETTER_MIN_CENTS;
const ORIGINAL_SERVER = process.env.POLAR_SERVER;

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  delete process.env.DEPOSIT_LETTER_MIN_CENTS;
  delete process.env.POLAR_SERVER;
});

afterEach(() => {
  setEnv('DEPOSIT_LETTER_MIN_CENTS', ORIGINAL_MIN);
  setEnv('POLAR_SERVER', ORIGINAL_SERVER);
});

describe('default behaviour (no override)', () => {
  it('enforces the real $49 floor', () => {
    expect(minDepositLetterCents()).toBe(4900);
  });

  it('rejects an order below $49', () => {
    expect(100 < minDepositLetterCents()).toBe(true);
  });

  it('accepts $49 and any higher A/B variant', () => {
    expect(4900 >= minDepositLetterCents()).toBe(true);
    expect(5900 >= minDepositLetterCents()).toBe(true);
  });
});

describe('live-test override', () => {
  it('lets a $1 order unlock the letter in sandbox', () => {
    process.env.POLAR_SERVER = 'sandbox';
    process.env.DEPOSIT_LETTER_MIN_CENTS = '100';
    expect(minDepositLetterCents()).toBe(100);
    expect(100 >= minDepositLetterCents()).toBe(true);
  });

  it('still rejects an order below the lowered floor', () => {
    process.env.POLAR_SERVER = 'sandbox';
    process.env.DEPOSIT_LETTER_MIN_CENTS = '100';
    expect(50 < minDepositLetterCents()).toBe(true);
  });
});

describe('guardrails — the override must not weaken production', () => {
  it('is IGNORED when Polar is in production mode', () => {
    process.env.POLAR_SERVER = 'production';
    process.env.DEPOSIT_LETTER_MIN_CENTS = '100';
    expect(minDepositLetterCents()).toBe(4900);
    // A $1 order must NOT unlock a real $49 letter.
    expect(100 < minDepositLetterCents()).toBe(true);
  });

  it('cannot RAISE the floor above the real price', () => {
    // Otherwise a typo would reject legitimate $49 orders — a worse failure
    // than the one the override enables.
    process.env.POLAR_SERVER = 'sandbox';
    process.env.DEPOSIT_LETTER_MIN_CENTS = '999999';
    expect(minDepositLetterCents()).toBe(4900);
  });

  it.each(['0', '-100', 'abc', '1.5', ''])(
    'ignores the invalid value %j',
    (value) => {
      process.env.POLAR_SERVER = 'sandbox';
      process.env.DEPOSIT_LETTER_MIN_CENTS = value;
      expect(minDepositLetterCents()).toBe(4900);
    },
  );
});

describe('production source carries the same guardrails', () => {
  const SOURCE = readFileSync(
    join(process.cwd(), 'src', 'lib', 'payments', 'webhook-processor.ts'),
    'utf-8',
  );

  it('reads the floor from the helper, not a hardcoded constant', () => {
    expect(SOURCE).toContain('minDepositLetterCents()');
  });

  it('keeps $49 as the default', () => {
    expect(SOURCE).toContain('DEFAULT_MIN_DEPOSIT_LETTER_CENTS = 4900');
  });

  it('disables the override in Polar production mode', () => {
    expect(SOURCE).toContain("process.env.POLAR_SERVER === 'production'");
  });

  it('clamps the override so it can only lower the floor', () => {
    expect(SOURCE).toContain('Math.min(parsed, DEFAULT_MIN_DEPOSIT_LETTER_CENTS)');
  });

  it('logs loudly when the test floor is active', () => {
    expect(SOURCE).toContain('TEST MODE');
  });
});
