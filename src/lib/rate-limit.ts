/**
 * Simple in-memory sliding-window rate limiter for sensitive endpoints
 * (invite joins, auth-adjacent actions).
 *
 * Note: memory is per server instance — on serverless platforms bursts are
 * still bounded per-instance. Documented in docs/SECURITY.md; a shared store
 * (e.g. Upstash/Redis) can replace this without changing call sites.
 */

type Window = number[];

const store = new Map<string, Window>();
// Persist across dev HMR reloads.
const globalStore = globalThis as typeof globalThis & { __rateLimits?: Map<string, Window> };
const buckets: Map<string, Window> = (globalStore.__rateLimits ??= store);

const MAX_KEYS = 5000;

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const window = buckets.get(key) ?? [];
  // Drop expired hits.
  let start = 0;
  while (start < window.length && window[start]! < now - windowMs) start++;
  const recent = start > 0 ? window.slice(start) : window;

  if (recent.length >= limit) {
    const retryAfterSeconds = Math.ceil((recent[0]! + windowMs - now) / 1000);
    buckets.set(key, recent);
    return { success: false, remaining: 0, retryAfterSeconds };
  }

  recent.push(now);
  if (buckets.size > MAX_KEYS) buckets.clear(); // crude bound against memory growth
  buckets.set(key, recent);
  return { success: true, remaining: limit - recent.length, retryAfterSeconds: 0 };
}

/** Best-effort client ip for rate-limit keys. */
export function clientKey(request: Request, salt: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0]!.trim() : "unknown";
  return `${salt}:${ip}`;
}
