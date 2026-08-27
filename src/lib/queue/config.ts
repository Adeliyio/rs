import type { JobsOptions } from 'bullmq';

/**
 * Queue name constants. Every BullMQ queue in the system
 * must be registered here.
 */
export const QUEUE_NAMES = {
  LETTER_GENERATE: 'letter-generate',
  SEQUENCE_GENERATE: 'sequence-generate',
  DEADLINE_CHECK: 'deadline-check',
  WEBHOOK_PROCESS: 'webhook-process',
  OUTCOME_FOLLOWUP: 'outcome-followup',
  // R-6: dedicated queue for ALL transactional email delivery. Previously all
  // emails rode on OUTCOME_FOLLOWUP; splitting them means a burst of one email
  // type (or the outcome delayed-job backlog) no longer starves the others.
  EMAIL_DELIVERY: 'email-delivery',
  LAW_MONITOR: 'law-monitor',
  // Rel-M1: replays stored-but-unprocessed Polar webhooks (processedAt null).
  REPROCESS_WEBHOOKS: 'reprocess-webhooks',
  // Scale-H3: daily retention cleanup for unbounded webhook_events + loginAttempts.
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Per-queue configuration including default job options.
 */
export interface QueueConfig {
  name: QueueName;
  defaultJobOptions: JobsOptions;
}

const DEFAULT_BACKOFF = {
  type: 'exponential' as const,
  delay: 1000,
};

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  [QUEUE_NAMES.LETTER_GENERATE]: {
    name: QUEUE_NAMES.LETTER_GENERATE,
    defaultJobOptions: {
      attempts: 2,
      backoff: DEFAULT_BACKOFF,
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  },
  [QUEUE_NAMES.SEQUENCE_GENERATE]: {
    name: QUEUE_NAMES.SEQUENCE_GENERATE,
    defaultJobOptions: {
      attempts: 2,
      backoff: DEFAULT_BACKOFF,
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  },
  [QUEUE_NAMES.DEADLINE_CHECK]: {
    name: QUEUE_NAMES.DEADLINE_CHECK,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 2000 },
      removeOnFail: { count: 5000 },
    },
  },
  [QUEUE_NAMES.WEBHOOK_PROCESS]: {
    name: QUEUE_NAMES.WEBHOOK_PROCESS,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 2000 },
      removeOnFail: { count: 5000 },
    },
  },
  [QUEUE_NAMES.OUTCOME_FOLLOWUP]: {
    name: QUEUE_NAMES.OUTCOME_FOLLOWUP,
    defaultJobOptions: {
      attempts: 3,
      backoff: DEFAULT_BACKOFF,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 3000 },
    },
  },
  [QUEUE_NAMES.EMAIL_DELIVERY]: {
    name: QUEUE_NAMES.EMAIL_DELIVERY,
    defaultJobOptions: {
      attempts: 3,
      backoff: DEFAULT_BACKOFF,
      removeOnComplete: { count: 2000 },
      removeOnFail: { count: 5000 },
    },
  },
  [QUEUE_NAMES.LAW_MONITOR]: {
    name: QUEUE_NAMES.LAW_MONITOR,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  },
  [QUEUE_NAMES.REPROCESS_WEBHOOKS]: {
    name: QUEUE_NAMES.REPROCESS_WEBHOOKS,
    defaultJobOptions: {
      // The poll itself is cheap and idempotent; a couple of retries is plenty.
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 2000 },
    },
  },
  [QUEUE_NAMES.CLEANUP]: {
    name: QUEUE_NAMES.CLEANUP,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  },
};
