/**
 * In-memory rate limiter using a fixed-window counter per (userId, routeClass).
 *
 * Known v1 limitations:
 *   - Cross-instance: state lives in one Node process. Multi-instance deployments
 *     would need Redis or a Postgres rate_limit table.
 *   - Window fairness: fixed-window allows ~2x the limit across window boundaries.
 *     Acceptable for burst protection; not a true sliding window.
 *
 * Both are intentional v1 trade-offs, revisit only if production traffic shows they matter.
 */

export type RouteClass = "save" | "recognize" | "catalog_read" | "default";

interface BucketConfig { max: number; windowMs: number }

const CONFIGS: Record<RouteClass, BucketConfig> = {
  save: { max: 60, windowMs: 60_000 },
  recognize: { max: 30, windowMs: 60_000 },
  catalog_read: { max: 120, windowMs: 60_000 },
  default: { max: 60, windowMs: 60_000 },
};

interface BucketState { count: number; resetAt: number }

const buckets = new Map<string, BucketState>();
const MAX_BUCKETS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = 0;

function cleanupExpired(now: number): void {
  for (const [k, v] of buckets) { if (v.resetAt < now) buckets.delete(k); }
  lastCleanup = now;
}

function evictOldestIfFull(): void {
  if (buckets.size < MAX_BUCKETS) return;
  let oldestKey: string | null = null;
  let oldestResetAt = Infinity;
  for (const [k, v] of buckets) { if (v.resetAt < oldestResetAt) { oldestResetAt = v.resetAt; oldestKey = k; } }
  if (oldestKey) buckets.delete(oldestKey);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

export function checkRateLimit(userId: string, routeClass: RouteClass = "default"): RateLimitResult {
  const now = Date.now();
  if (now - lastCleanup >= CLEANUP_INTERVAL_MS) cleanupExpired(now);

  const cfg = CONFIGS[routeClass];
  const key = `${routeClass}:${userId}`;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    evictOldestIfFull();
    bucket = { count: 0, resetAt: now + cfg.windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= cfg.max) {
    return { allowed: false, remaining: 0, limit: cfg.max, resetAt: bucket.resetAt, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: cfg.max - bucket.count, limit: cfg.max, resetAt: bucket.resetAt };
}

/** Test helper — only for unit tests. Production code must not call this. */
export function __resetRateLimitBuckets(): void { buckets.clear(); lastCleanup = 0; }
