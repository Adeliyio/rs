import Redis from 'ioredis';

let _redis: Redis | null = null;

/**
 * Returns a lazily-initialized Redis singleton.
 * The connection is not created at import time so that builds
 * (which may not have REDIS_URL set) do not crash.
 */
export function getRedis(): Redis {
  if (_redis) {
    return _redis;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL environment variable is not set. Cannot create Redis connection.'
    );
  }

  _redis = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  });

  _redis.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  _redis.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  return _redis;
}

/**
 * Gracefully close the Redis connection.
 * Call this during application shutdown.
 */
export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
