import { z } from 'zod';
import { VENUE_TYPE, DEPOSIT_JURISDICTION } from '@/types/enums';

export const packetGenerationJobSchema = z.object({
  case_id: z.string().uuid(),
  user_id: z.string().uuid(),
  venue_type: z.enum(VENUE_TYPE),
  jurisdiction: z.enum(DEPOSIT_JURISDICTION),
  county: z.string().optional(),
});

export type PacketGenerationJobPayload = z.infer<typeof packetGenerationJobSchema>;
