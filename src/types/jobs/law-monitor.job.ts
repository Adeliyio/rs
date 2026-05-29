import { z } from 'zod';

/**
 * Job payload for the law monitor worker.
 *
 * For repeatable (weekly) runs, only `run_type` is needed.
 * For ad-hoc scans triggered by admin, `statute_ids` can scope
 * the check to specific statutes instead of all KB entries.
 */
export const lawMonitorJobSchema = z.object({
  run_type: z.enum(['scheduled', 'manual']),
  statute_ids: z.array(z.string()).optional(),
  triggered_by: z.string().email().optional(),
});

export type LawMonitorJobPayload = z.infer<typeof lawMonitorJobSchema>;
