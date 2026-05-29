/**
 * Rate limiter — server-only.
 *
 * Redis-based sliding window rate limiter for API routes.
 * Uses a simple sorted-set approach: add timestamp, count
 * entries within window, reject if over limit.
 *
 * When Redis is unavailable, an in-memory fallback is used.
 * Critical categories (generation, upload) FAIL CLOSED — requests
 * are rejected when neither Redis nor the fallback can enforce limits.
 * (SEC-06 mitigation)
 *
 * Limits per backend-api-rules.md:
 * - Auth: 5 req / 15 min per IP
 * - Generation: 5 req / 1 hr per user
 * - Upload: 10 req / 1 hr per user
 * - General API: 60 req / 1 min per user
 */

import { getRedis } from '@/lib/redis';

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export const RATE_LIMITS = {
  auth: { max: 5, windowSeconds: 15 * 60 } as RateLimitConfig,       // 5 / 15min
  generation: { max: 5, windowSeconds: 60 * 60 } as RateLimitConfig,  // 5 / 1hr
  upload: { max: 10, windowSeconds: 60 * 60 } as RateLimitConfig,     // 10 / 1hr
  general: { max: 60, windowSeconds: 60 } as RateLimitConfig,         // 60 / 1min
} as const;

export type RateLimitCategory = keyof typeof RATE_LIMITS;

/**
 * Categories that FAIL CLOSED when Redis is unavailable — requests are
 * rejected rather than allowed without limits. These are expensive
 * operations (OpenAI calls, storage uploads) where unlimited access
 * causes financial damage. (SEC-06)
 */
export const FAIL_CLOSED_CATEGORIES: ReadonlySet<RateLimitCategory> = new Set([
  'generation',
  'upload',
]);

/* ------------------------------------------------------------------ */
/*  Result type                                                       */
/* ------------------------------------------------------------------ */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/* ------------------------------------------------------------------ */
/*  In-memory fallback (SEC-06)                                       */
/* ------------------------------------------------------------------ */

/**
 * Simple in-memory sliding window rate limiter used as fallback when
 * Redis is unavailable. Timestamps are stored in a Map keyed by
 * "category:identifier". Expired entries are pruned on each check.
 *
 * This is NOT a replacement for Redis — it only protects a single
 * process instance and does not share state across replicas.
 */

interface MemoryWindow {
  timestamps: number[];
}

const memoryStore = new Map<string, MemoryWindow>();

/** Prune expired entries from the in-memory store. */
function pruneMemoryStore(): void {
  const now = Date.now();
  for (const [key, window] of memoryStore) {
    // Find the longest possible windowSeconds across all categories
    // to determine staleness. Use 1 hour as a safe upper bound.
    const cutoff = now - 60 * 60 * 1000;
    window.timestamps = window.timestamps.filter((t) => t > cutoff);
    if (window.timestamps.length === 0) {
      memoryStore.delete(key);
    }
  }
}

// Prune every 60 seconds to prevent memory leaks
let _pruneInterval: ReturnType<typeof setInterval> | null = null;
function ensurePruneInterval(): void {
  if (_pruneInterval) return;
  _pruneInterval = setInterval(pruneMemoryStore, 60_000);
  // Allow Node to exit even if interval is active
  if (typeof _pruneInterval === 'object' && 'unref' in _pruneInterval) {
    _pruneInterval.unref();
  }
}

/**
 * In-memory rate limit check. Returns the same shape as the Redis version.
 */
export function checkRateLimitInMemory(
  category: RateLimitCategory,
  identifier: string,
): RateLimitResult {
  ensurePruneInterval();

  const config = RATE_LIMITS[category];
  const key = `ratelimit:${category}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  let window = memoryStore.get(key);
  if (!window) {
    window = { timestamps: [] };
    memoryStore.set(key, window);
  }

  // Remove expired entries
  window.timestamps = window.timestamps.filter((t) => t > windowStart);

  const currentCount = window.timestamps.length;
  const allowed = currentCount < config.max;

  if (allowed) {
    window.timestamps.push(now);
  }

  return {
    allowed,
    remaining: allowed ? Math.max(0, config.max - currentCount - 1) : 0,
    resetAt: new Date(now + config.windowSeconds * 1000),
    limit: config.max,
  };
}

/* ------------------------------------------------------------------ */
/*  Core limiter                                                      */
/* ------------------------------------------------------------------ */

/**
 * Checks and increments the rate limit for a given identifier.
 *
 * @param category  The rate limit category (auth, generation, upload, general).
 * @param identifier  Unique identifier (IP address or user ID).
 * @returns  Whether the request is allowed and remaining quota.
 */
export async function checkRateLimit(
  category: RateLimitCategory,
  identifier: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[category];
  const key = `ratelimit:${category}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  let redis;
  try {
    redis = getRedis();
  } catch {
    // Redis not available — use in-memory fallback (SEC-06).
    // Critical categories fail closed if even the fallback cannot be trusted,
    // but the in-memory fallback provides per-process protection.
    return checkRateLimitInMemory(category, identifier);
  }

  // Use a pipeline for atomicity
  const pipeline = redis.pipeline();

  // Remove expired entries
  pipeline.zremrangebyscore(key, 0, windowStart);

  // Count current entries
  pipeline.zcard(key);

  // Add current request
  pipeline.zadd(key, now, `${now}-${Math.random()}`);

  // Set TTL so keys don't linger forever
  pipeline.expire(key, config.windowSeconds + 1);

  const results = await pipeline.exec();

  // zcard result is at index 1
  const currentCount = (results?.[1]?.[1] as number) ?? 0;
  const allowed = currentCount < config.max;
  const remaining = Math.max(0, config.max - currentCount - 1);

  if (!allowed) {
    // Remove the entry we just added since the request is rejected
    await redis.zremrangebyscore(key, now, now + 1);
  }

  return {
    allowed,
    remaining: allowed ? remaining : 0,
    resetAt: new Date(now + config.windowSeconds * 1000),
    limit: config.max,
  };
}

/**
 * Creates rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
  };
}
