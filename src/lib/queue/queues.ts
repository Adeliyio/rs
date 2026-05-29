import { Queue } from 'bullmq';
import { getRedis } from '@/lib/redis';
import { QUEUE_CONFIGS, type QueueName } from './config';

/**
 * Lazily-initialized map of BullMQ Queue instances.
 * Queues are created on first access so that importing this module
 * does not require a live Redis connection (safe at build time).
 */
const _queues = new Map<QueueName, Queue>();

/**
 * Returns a typed BullMQ Queue for the given queue name.
 * Creates the Queue instance lazily on first call.
 */
export function getQueue(name: QueueName): Queue {
  const existing = _queues.get(name);
  if (existing) {
    return existing;
  }

  const config = QUEUE_CONFIGS[name];
  const connection = getRedis();

  const queue = new Queue(config.name, {
    connection,
    defaultJobOptions: config.defaultJobOptions,
  });

  _queues.set(name, queue);
  return queue;
}

/**
 * Gracefully close all open queue connections.
 * Call this during application shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];
  for (const [, queue] of _queues) {
    closePromises.push(queue.close());
  }
  await Promise.all(closePromises);
  _queues.clear();
}
