import { z } from 'zod';

export const emailDeliveryJobSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  template_id: z.string().min(1),
  template_data: z.record(z.string(), z.string()),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        content: z.string().min(1),
        content_type: z.string().optional(),
      }),
    )
    .optional(),
});

export type EmailDeliveryJobPayload = z.infer<typeof emailDeliveryJobSchema>;
