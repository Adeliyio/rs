/**
 * Deadline scheduler — server-only.
 *
 * Creates deadline_events records in the database and optionally
 * enqueues BullMQ jobs to fire prompts at the right time.
 *
 * Flow:
 * 1. computeDeadlines() calculates concrete dates
 * 2. scheduleDeadlines() persists them to deadline_events table
 * 3. A cron job (deadline-check queue) polls for due deadlines
 * 4. When a deadline fires, it sends in-app + email notifications
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { ComputedDeadline } from '@/lib/deadlines/calculator';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ScheduleResult {
  scheduled: number;
  skipped: number;
  errors: string[];
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Persists computed deadlines to the deadline_events table.
 * Skips deadlines that have already been scheduled for this case.
 *
 * @param supabase  Authenticated or service-role Supabase client.
 * @param caseId  The case ID.
 * @param deadlines  Computed deadlines from the calculator.
 * @param timezone  IANA timezone string.
 * @returns  Schedule result with counts.
 */
export async function scheduleDeadlines(
  supabase: SupabaseClient<Database>,
  caseId: string,
  deadlines: ComputedDeadline[],
  timezone: string,
): Promise<ScheduleResult> {
  let scheduled = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Load existing deadline events for this case to avoid duplicates
  const { data: existing, error: fetchError } = await supabase
    .from('deadline_events')
    .select('id, anchor_event, deadline_date')
    .eq('case_id', caseId);

  if (fetchError) {
    return {
      scheduled: 0,
      skipped: 0,
      errors: [`Failed to fetch existing deadlines: ${fetchError.message}`],
    };
  }

  // Build a set of existing rule_ids (using anchor_event + deadline_date as key)
  const existingKeys = new Set(
    (existing ?? []).map(
      (e) => {
        const row = e as unknown as { anchor_event: string; deadline_date: string };
        return `${row.anchor_event}:${row.deadline_date}`;
      },
    ),
  );

  for (const deadline of deadlines) {
    const key = `${deadline.anchor_event}:${deadline.deadline_date.toISOString()}`;

    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const payload: Record<string, unknown> = {
      case_id: caseId,
      deadline_date: deadline.deadline_date.toISOString(),
      timezone,
      anchor_event: deadline.anchor_event,
      prompt_message: deadline.prompt_message,
    };

    const { error: insertError } = await supabase
      .from('deadline_events')
      // @ts-expect-error — Supabase generic doesn't resolve table Insert type
      .insert(payload);

    if (insertError) {
      errors.push(
        `Failed to schedule deadline ${deadline.rule_id}: ${insertError.message}`,
      );
      continue;
    }

    scheduled++;
  }

  return { scheduled, skipped, errors };
}

/**
 * Marks a deadline event as fired (prompt was sent).
 */
export async function markDeadlineFired(
  supabase: SupabaseClient<Database>,
  deadlineEventId: string,
): Promise<void> {
  await supabase
    .from('deadline_events')
    // @ts-expect-error — Supabase SSR generic doesn't resolve table Update type from manual Database definition
    .update({ fired_at: new Date().toISOString() })
    .eq('id', deadlineEventId);
}

/**
 * Fetches all unfired, undismissed deadline events that are due
 * (deadline_date <= now). Used by the deadline-check cron job.
 */
export async function getDueDeadlines(
  supabase: SupabaseClient<Database>,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('deadline_events')
    .select('*')
    .is('fired_at', null)
    .is('dismissed_at', null)
    .lte('deadline_date', new Date().toISOString())
    .order('deadline_date', { ascending: true })
    .limit(100);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch due deadlines:', error.message);
    return [];
  }

  return (data ?? []) as Record<string, unknown>[];
}
