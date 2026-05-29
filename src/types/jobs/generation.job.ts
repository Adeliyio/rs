import { z } from 'zod';
import { WEDGE, DEPOSIT_JURISDICTION } from '@/types/enums';

export const generationJobSchema = z.object({
  case_id: z.string().uuid(),
  user_id: z.string().uuid(),
  wedge: z.enum(WEDGE),
  jurisdiction: z.enum(DEPOSIT_JURISDICTION),
  idempotency_key: z.string().min(1),
});

export type GenerationJobPayload = z.infer<typeof generationJobSchema>;
