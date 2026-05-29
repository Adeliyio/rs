import { z } from 'zod';

export const deadlinePromptJobSchema = z.object({
  deadline_event_id: z.string().uuid(),
  case_id: z.string().uuid(),
  user_id: z.string().uuid(),
  prompt_message: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']),
  deadline_date: z.string().min(1),
  timezone: z.string().min(1),
});

export type DeadlinePromptJobPayload = z.infer<typeof deadlinePromptJobSchema>;
