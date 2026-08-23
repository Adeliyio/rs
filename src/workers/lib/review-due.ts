/**
 * KB review-due detection — pure, dependency-free so it is unit-testable
 * without pulling in Redis/Convex/OpenAI (which the worker module does).
 *
 * An entry is "due" when now is past its verification.next_review_due, or (if
 * that field is absent/unparseable) when last_verified is older than
 * STALE_VERIFICATION_DAYS. This realizes the documented periodic-review cadence
 * at runtime — the counterpart to the worker's change-detection pass.
 */

import type { KbEntry } from '@/types/kb.types';

/**
 * If an entry has no next_review_due, treat it as due when last_verified is
 * older than this. Mirrors the CI staleness warning line (180 days).
 */
export const STALE_VERIFICATION_DAYS = 180;

const MS_PER_DAY = 86_400_000;

export interface LoadedKbEntry {
  wedge: string;
  jurisdiction: string;
  entry: KbEntry;
}

/**
 * Return one human-readable row per KB entry overdue for review. `now` is
 * injectable for deterministic tests.
 */
export function findEntriesDueForReview(
  entries: LoadedKbEntry[],
  now: Date = new Date(),
): string[] {
  const rows: string[] = [];

  for (const { jurisdiction, entry } of entries) {
    // The loader does not Zod-validate, so guard against malformed runtime JSON
    // even though the type says verification is always present.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const v = entry.verification;
    if (!v) continue;

    const dueRaw = v.next_review_due;
    const lastRaw = v.last_verified;

    let isDue = false;
    let reason = '';

    const dueDate = dueRaw ? new Date(dueRaw) : null;
    if (dueDate && !Number.isNaN(dueDate.getTime())) {
      if (dueDate.getTime() <= now.getTime()) {
        isDue = true;
        reason = `review due ${dueRaw}`;
      }
    } else {
      // No usable next_review_due — fall back to last_verified age.
      const lastDate = lastRaw ? new Date(lastRaw) : null;
      if (lastDate && !Number.isNaN(lastDate.getTime())) {
        const ageDays = Math.floor((now.getTime() - lastDate.getTime()) / MS_PER_DAY);
        if (ageDays > STALE_VERIFICATION_DAYS) {
          isDue = true;
          reason = `last verified ${ageDays}d ago (no next_review_due set)`;
        }
      } else {
        // Neither date is usable — flag it so it doesn't hide forever.
        isDue = true;
        reason = 'no usable verification dates';
      }
    }

    if (isDue) {
      rows.push(`${jurisdiction} (${entry.id}) — ${reason}`);
    }
  }

  return rows;
}
