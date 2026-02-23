/**
 * Rate limiter with Upstash Redis backend.
 *
 * Falls back to in-memory sliding window when UPSTASH_REDIS_REST_URL
 * is not configured (local development, preview deploys).
 *
 * The public API (rateLimit / rateLimitHeaders) is unchanged so callers
 * (/api/sync, /api/upload) need no modifications.
 */

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

// ──────────────────────────────────────────────
// In-memory fallback (dev / preview)
// ──────────────────────────────────────────────

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function memoryCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt < now) memoryStore.delete(key);
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  memoryCleanup();
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

// ──────────────────────────────────────────────
// Upstash Redis backend
// ──────────────────────────────────────────────

/**
 * Calls the Upstash REST API directly (no SDK dependency needed).
 * Uses a sliding-window counter via Redis INCR + PEXPIRE.
 */
async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `rl:${key}`;
  const now = Date.now();

  try {
    // Pipeline: INCR then PTTL
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PTTL", redisKey],
      ]),
      // Avoid caching in Next.js
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);

    const results = (await res.json()) as Array<{ result: number }>;
    const count = results[0].result;
    const ttl = results[1].result;

    // First request in this window — set expiry
    if (count === 1 || ttl < 0) {
      await fetch(`${url}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["PEXPIRE", redisKey, String(windowMs)]),
        cache: "no-store",
      });
    }

    const resetAt = now + (ttl > 0 ? ttl : windowMs);
    const remaining = Math.max(0, limit - count);

    return {
      success: count <= limit,
      remaining,
      resetAt,
    };
  } catch {
    // Redis unavailable — fall back to memory so the app doesn't break
    console.warn("[rate-limit] Redis unavailable, falling back to in-memory");
    return memoryRateLimit(key, limit, windowMs);
  }
}

// ──────────────────────────────────────────────
// Detect backend
// ──────────────────────────────────────────────

const useRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
);

// ──────────────────────────────────────────────
// Public API (unchanged signature)
// ──────────────────────────────────────────────

/**
 * Check if a request should be rate-limited.
 * @param key - Unique identifier (e.g., IP address, user ID)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  if (useRedis) {
    return redisRateLimit(key, limit, windowMs);
  }
  return memoryRateLimit(key, limit, windowMs);
}

/**
 * Rate-limit check for API routes — returns a 429 header map if exceeded.
 */
export async function rateLimitHeaders(
  key: string,
  limit: number,
  windowMs?: number
): Promise<{ limited: boolean; headers: Record<string, string> }> {
  const result = await rateLimit(key, limit, windowMs);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.success) {
    headers["Retry-After"] = String(
      Math.ceil((result.resetAt - Date.now()) / 1000)
    );
  }
  return { limited: !result.success, headers };
}
