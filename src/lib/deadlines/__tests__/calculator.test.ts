/**
 * Tests for deadline calculator.
 *
 * Tests deadline date computation, severity calculation, anchor
 * date resolution, and actionable deadline filtering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeDeadlines,
  getActionableDeadlines,
  type ComputedDeadline,
} from '@/lib/deadlines/calculator';
import type { DeadlineRule } from '@/types/kb.types';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

const caDeadlineRules: DeadlineRule[] = [
  {
    rule_id: 'ca-deposit-return-21',
    statute_id: 'ca-civ-1950.5',
    deadline_days: 21,
    anchor_event: 'move_out',
    action_at_expiry: 'Landlord must return deposit or provide itemized statement',
    description: '21-day deadline for deposit return',
    prompt_message: 'The 21-day deadline has passed.',
    is_statutory: true,
  },
  {
    rule_id: 'ca-deposit-demand-letter-sent',
    statute_id: 'ca-civ-1950.5',
    deadline_days: 30,
    anchor_event: 'letter_sent',
    action_at_expiry: 'Consider filing small claims',
    description: '30 days after demand letter',
    prompt_message: 'It has been 30 days since your demand letter.',
    is_statutory: false,
  },
];

const timezone = 'America/Los_Angeles';

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  // Fix "now" to 2025-02-10 for deterministic tests
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-02-10T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/*  computeDeadlines                                                  */
/* ------------------------------------------------------------------ */

describe('computeDeadlines', () => {
  it('computes deadline from move_out anchor', () => {
    const answers = { move_out: '2025-01-15' };
    const { deadlines, errors } = computeDeadlines(
      caDeadlineRules,
      answers,
      timezone,
    );

    expect(errors).toHaveLength(0);
    expect(deadlines).toHaveLength(1); // Only move_out rule has data

    const deadline = deadlines[0]!;
    expect(deadline.rule_id).toBe('ca-deposit-return-21');
    expect(deadline.deadline_days).toBe(21);
    expect(deadline.anchor_event).toBe('move_out');
    // Jan 15 + 21 days = Feb 5 (UTC date may shift due to timezone)
    const deadlineDateStr = deadline.deadline_date.toISOString();
    expect(
      deadlineDateStr.startsWith('2025-02-05') ||
        deadlineDateStr.startsWith('2025-02-04'),
    ).toBe(true);
    expect(deadline.is_expired).toBe(true); // Feb 10 > Feb 5
    expect(deadline.severity).toBe('critical'); // expired = critical
  });

  it('computes multiple deadlines when both anchors available', () => {
    const answers = {
      move_out: '2025-01-15',
      letter_sent: '2025-02-01',
    };
    const { deadlines } = computeDeadlines(
      caDeadlineRules,
      answers,
      timezone,
    );

    expect(deadlines).toHaveLength(2);
    // Sorted by deadline_date ascending
    expect(deadlines[0]!.rule_id).toBe('ca-deposit-return-21'); // Feb 5
    expect(deadlines[1]!.rule_id).toBe('ca-deposit-demand-letter-sent'); // Mar 3
  });

  it('skips rules with unavailable anchor dates', () => {
    const answers = { move_out: '2025-01-15' };
    // letter_sent not provided
    const { deadlines } = computeDeadlines(
      caDeadlineRules,
      answers,
      timezone,
    );

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]!.rule_id).toBe('ca-deposit-return-21');
  });

  it('handles invalid date strings gracefully', () => {
    const answers = { move_out: 'not-a-date' };
    const { deadlines } = computeDeadlines(
      caDeadlineRules,
      answers,
      timezone,
    );

    expect(deadlines).toHaveLength(0);
  });

  it('handles empty answers', () => {
    const { deadlines, errors } = computeDeadlines(
      caDeadlineRules,
      {},
      timezone,
    );

    expect(deadlines).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('handles empty rules', () => {
    const { deadlines } = computeDeadlines(
      [],
      { move_out: '2025-01-15' },
      timezone,
    );

    expect(deadlines).toHaveLength(0);
  });

  it('calculates days_remaining correctly for future deadlines', () => {
    // Set move_out to Feb 5 → deadline is Feb 26 (21 days)
    // "Now" is Feb 10 → 16 days remaining
    const answers = { move_out: '2025-02-05' };
    const { deadlines } = computeDeadlines(
      [caDeadlineRules[0]!],
      answers,
      timezone,
    );

    const deadline = deadlines[0]!;
    expect(deadline.is_expired).toBe(false);
    expect(deadline.days_remaining).toBe(16);
  });

  it('sets days_remaining to 0 for expired deadlines', () => {
    const answers = { move_out: '2025-01-01' }; // Jan 1 + 21 = Jan 22 (expired)
    const { deadlines } = computeDeadlines(
      [caDeadlineRules[0]!],
      answers,
      timezone,
    );

    const deadline = deadlines[0]!;
    expect(deadline.is_expired).toBe(true);
    expect(deadline.days_remaining).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Severity                                                          */
/* ------------------------------------------------------------------ */

describe('severity calculation', () => {
  it('returns critical for expired deadlines', () => {
    const answers = { move_out: '2025-01-01' };
    const { deadlines } = computeDeadlines(
      [caDeadlineRules[0]!],
      answers,
      timezone,
    );

    expect(deadlines[0]!.severity).toBe('critical');
  });

  it('returns warning for statutory deadlines within 7 days', () => {
    // move_out Feb 3 → deadline Feb 24 → 14 days from Feb 10. That's info.
    // move_out Jan 27 → deadline Feb 17 → 7 days from Feb 10. That's warning.
    const answers = { move_out: '2025-01-27' };
    const { deadlines } = computeDeadlines(
      [caDeadlineRules[0]!],
      answers,
      timezone,
    );

    expect(deadlines[0]!.severity).toBe('warning');
  });

  it('returns info for future deadlines beyond window', () => {
    const answers = { move_out: '2025-02-05' }; // deadline Feb 26, 16 days out
    const { deadlines } = computeDeadlines(
      [caDeadlineRules[0]!],
      answers,
      timezone,
    );

    expect(deadlines[0]!.severity).toBe('info');
  });
});

/* ------------------------------------------------------------------ */
/*  getActionableDeadlines                                            */
/* ------------------------------------------------------------------ */

describe('getActionableDeadlines', () => {
  it('includes expired deadlines', () => {
    const deadlines: ComputedDeadline[] = [
      {
        rule_id: 'expired',
        statute_id: 'test',
        anchor_event: 'move_out',
        anchor_date: new Date('2025-01-01'),
        deadline_date: new Date('2025-01-22'),
        deadline_days: 21,
        days_remaining: 0,
        is_expired: true,
        is_statutory: true,
        prompt_message: 'Expired',
        description: 'Test',
        action_at_expiry: 'Test',
        severity: 'critical',
      },
    ];

    const actionable = getActionableDeadlines(deadlines);
    expect(actionable).toHaveLength(1);
    expect(actionable[0]!.rule_id).toBe('expired');
  });

  it('includes deadlines within prompt window', () => {
    const deadlines: ComputedDeadline[] = [
      {
        rule_id: 'soon',
        statute_id: 'test',
        anchor_event: 'move_out',
        anchor_date: new Date('2025-01-25'),
        deadline_date: new Date('2025-02-15'),
        deadline_days: 21,
        days_remaining: 5,
        is_expired: false,
        is_statutory: true,
        prompt_message: 'Soon',
        description: 'Test',
        action_at_expiry: 'Test',
        severity: 'warning',
      },
    ];

    const actionable = getActionableDeadlines(deadlines, 7);
    expect(actionable).toHaveLength(1);
  });

  it('excludes future deadlines outside prompt window', () => {
    const deadlines: ComputedDeadline[] = [
      {
        rule_id: 'future',
        statute_id: 'test',
        anchor_event: 'move_out',
        anchor_date: new Date('2025-02-01'),
        deadline_date: new Date('2025-03-01'),
        deadline_days: 21,
        days_remaining: 20,
        is_expired: false,
        is_statutory: true,
        prompt_message: 'Future',
        description: 'Test',
        action_at_expiry: 'Test',
        severity: 'info',
      },
    ];

    const actionable = getActionableDeadlines(deadlines, 7);
    expect(actionable).toHaveLength(0);
  });

  it('uses default 7-day window', () => {
    const deadlines: ComputedDeadline[] = [
      {
        rule_id: 'at-boundary',
        statute_id: 'test',
        anchor_event: 'move_out',
        anchor_date: new Date('2025-01-27'),
        deadline_date: new Date('2025-02-17'),
        deadline_days: 21,
        days_remaining: 7,
        is_expired: false,
        is_statutory: true,
        prompt_message: 'Boundary',
        description: 'Test',
        action_at_expiry: 'Test',
        severity: 'warning',
      },
    ];

    const actionable = getActionableDeadlines(deadlines);
    expect(actionable).toHaveLength(1);
  });

  it('handles empty array', () => {
    const actionable = getActionableDeadlines([]);
    expect(actionable).toHaveLength(0);
  });
});
