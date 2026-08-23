import { describe, it, expect } from 'vitest';

import { findEntriesDueForReview } from '../lib/review-due';
import type { KbEntry } from '@/types/kb.types';

/**
 * Fix #2 — the review-due scan. It must flag KB entries past their
 * next_review_due, fall back to last_verified age when that date is missing,
 * and leave fresh entries alone. `now` is injected so the test is deterministic.
 */

function entry(over: Partial<KbEntry['verification']>, id = 'deposit-XX', jur = 'XX'): {
  wedge: string;
  jurisdiction: string;
  entry: KbEntry;
} {
  return {
    wedge: 'deposit',
    jurisdiction: jur,
    entry: {
      id,
      wedge: 'deposit',
      jurisdiction: jur,
      statutes: [],
      deadline_rules: [],
      penalties: [],
      escalation_venues: [],
      permissible_deductions: [],
      verification: {
        last_verified: '2026-05-20',
        verified_by: 'test',
        primary_sources_checked: [],
        next_review_due: '2026-08-20',
        ...over,
      },
    } as unknown as KbEntry,
  };
}

const NOW = new Date('2026-08-23T00:00:00Z');

describe('findEntriesDueForReview', () => {
  it('flags an entry whose next_review_due has passed', () => {
    const rows = findEntriesDueForReview([entry({ next_review_due: '2026-08-20' })], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('review due 2026-08-20');
  });

  it('does NOT flag an entry whose next_review_due is still in the future', () => {
    const rows = findEntriesDueForReview([entry({ next_review_due: '2026-08-24' })], NOW);
    expect(rows).toEqual([]);
  });

  it('treats the review date as inclusive (due exactly today = due)', () => {
    const rows = findEntriesDueForReview([entry({ next_review_due: '2026-08-23' })], NOW);
    expect(rows).toHaveLength(1);
  });

  it('falls back to last_verified age when next_review_due is missing (stale)', () => {
    const rows = findEntriesDueForReview(
      [entry({ next_review_due: '', last_verified: '2025-01-01' })],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('no next_review_due set');
  });

  it('does NOT flag a fresh entry with no next_review_due but recent last_verified', () => {
    const rows = findEntriesDueForReview(
      [entry({ next_review_due: '', last_verified: '2026-08-01' })],
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it('flags an entry with no usable dates at all', () => {
    const rows = findEntriesDueForReview(
      [entry({ next_review_due: '', last_verified: '' })],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('no usable verification dates');
  });

  it('reflects the real KB state today: TX/NY/FL due, CA not yet', () => {
    // Mirrors the actual next_review_due dates in the repo as of 2026-08-23.
    const rows = findEntriesDueForReview(
      [
        entry({ next_review_due: '2026-08-24' }, 'deposit-CA', 'CA'),
        entry({ next_review_due: '2026-08-20' }, 'deposit-TX', 'TX'),
        entry({ next_review_due: '2026-08-20' }, 'deposit-NY', 'NY'),
        entry({ next_review_due: '2026-08-20' }, 'deposit-FL', 'FL'),
      ],
      NOW,
    );
    expect(rows).toHaveLength(3);
    expect(rows.join(' ')).not.toContain('CA');
    expect(rows.join(' ')).toContain('TX');
  });
});
