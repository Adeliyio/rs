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
  LAW_MONITOR: 'law-monitor',
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
  [QUEUE_NAMES.LAW_MONITOR]: {
    name: QUEUE_NAMES.LAW_MONITOR,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  },
};
