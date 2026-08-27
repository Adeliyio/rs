import { z } from 'zod';

export const webhookProcessingJobSchema = z.object({
  event_id: z.string().min(1),
  provider: z.enum(['polar', 'resend']),
  raw_payload: z.string().min(1),
  received_at: z.string().min(1),
});

export type WebhookProcessingJobPayload = z.infer<typeof webhookProcessingJobSchema>;
