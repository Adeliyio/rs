/**
 * Deadline scheduler — server-only.
 *
 * Persists computed deadlines to Convex (deadlineEvents) via the service layer,
 * replacing the former Supabase-client-based implementation. Called from server
 * routes and workers alike, all of which use the service Convex client.
 */

import { workerConvex, api } from '@/lib/convex/worker-client';
import type { Id } from '@convex/dataModel';
import type { ComputedDeadline } from '@/lib/deadlines/calculator';

export interface ScheduleResult {
  scheduled: number;
  skipped: number;
  errors: string[];
}

/**
 * Persists computed deadlines. Skips deadlines already scheduled for this case
 * (keyed by anchor_event + deadline_date), preserving the old dedup behaviour.
 */
export async function scheduleDeadlines(
  caseId: string,
  deadlines: ComputedDeadline[],
  timezone: string,
): Promise<ScheduleResult> {
  let scheduled = 0;
  let skipped = 0;
  const errors: string[] = [];

  let existing: { anchor_event: string; deadline_date: string | null }[];
  try {
    existing = await workerConvex.query(api.service.listDeadlinesByCase, {
      caseId: caseId as Id<'cases'>,
    });
  } catch (err) {
    return {
      scheduled: 0,
      skipped: 0,
      errors: [`Failed to fetch existing deadlines: ${err instanceof Error ? err.message : 'unknown'}`],
    };
  }

  const existingKeys = new Set(
    existing.map((e) => `${e.anchor_event}:${e.deadline_date ?? ''}`),
  );

  for (const deadline of deadlines) {
    // Existing keys use the serialized ISO string; compare on ISO form.
    const iso = deadline.deadline_date.toISOString();
    const key = `${deadline.anchor_event}:${iso}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    try {
      await workerConvex.mutation(api.service.createDeadline, {
        caseId: caseId as Id<'cases'>,
        deadlineDate: deadline.deadline_date.getTime(),
        timezone,
        anchorEvent: deadline.anchor_event,
        promptMessage: deadline.prompt_message,
      });
      scheduled++;
    } catch (err) {
      errors.push(
        `Failed to schedule deadline ${deadline.rule_id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  return { scheduled, skipped, errors };
}
