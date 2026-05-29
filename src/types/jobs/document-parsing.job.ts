import { z } from 'zod';

export const documentParsingJobSchema = z.object({
  document_id: z.string().uuid(),
  case_id: z.string().uuid(),
  user_id: z.string().uuid(),
  file_path: z.string().min(1),
  content_type: z.string().min(1),
});

export type DocumentParsingJobPayload = z.infer<typeof documentParsingJobSchema>;
