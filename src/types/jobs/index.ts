export { generationJobSchema, type GenerationJobPayload } from './generation.job';
export {
  documentParsingJobSchema,
  type DocumentParsingJobPayload,
} from './document-parsing.job';
export {
  deadlinePromptJobSchema,
  type DeadlinePromptJobPayload,
} from './deadline-prompt.job';
export {
  webhookProcessingJobSchema,
  type WebhookProcessingJobPayload,
} from './webhook-processing.job';
export {
  emailDeliveryJobSchema,
  type EmailDeliveryJobPayload,
} from './email-delivery.job';
export {
  packetGenerationJobSchema,
  type PacketGenerationJobPayload,
} from './packet-generation.job';
export {
  lawMonitorJobSchema,
  type LawMonitorJobPayload,
} from './law-monitor.job';

/* ------------------------------------------------------------------ */
/*  Job type registry                                                 */
/* ------------------------------------------------------------------ */

import type { GenerationJobPayload } from './generation.job';
import type { DocumentParsingJobPayload } from './document-parsing.job';
import type { DeadlinePromptJobPayload } from './deadline-prompt.job';
import type { WebhookProcessingJobPayload } from './webhook-processing.job';
import type { EmailDeliveryJobPayload } from './email-delivery.job';
import type { PacketGenerationJobPayload } from './packet-generation.job';
import type { LawMonitorJobPayload } from './law-monitor.job';

export const JOB_TYPE = [
  'generation',
  'document_parsing',
  'deadline_prompt',
  'webhook_processing',
  'email_delivery',
  'packet_generation',
  'law_monitor',
] as const;

export type JobType = (typeof JOB_TYPE)[number];

export interface JobPayloadMap {
  generation: GenerationJobPayload;
  document_parsing: DocumentParsingJobPayload;
  deadline_prompt: DeadlinePromptJobPayload;
  webhook_processing: WebhookProcessingJobPayload;
  email_delivery: EmailDeliveryJobPayload;
  packet_generation: PacketGenerationJobPayload;
  law_monitor: LawMonitorJobPayload;
}
