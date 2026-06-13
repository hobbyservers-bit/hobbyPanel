import { redis } from "./redis";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limiter backed by Redis.
 * Fails open (allows the request) if Redis is unavailable so the site stays up.
 *
 * @param key      Unique key identifying the counter (e.g. "login:ip:1.2.3.4")
 * @param max      Maximum allowed attempts in the window
 * @param windowSec Window length in seconds
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSec);
  const redisKey = `rl:${key}:${bucket}`;
  const resetAt = new Date((bucket + 1) * windowSec * 1000);

  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSec + 5);
    return { ok: count <= max, limit: max, remaining: Math.max(0, max - count), resetAt };
  } catch {
    // Redis unavailable — fail open so auth still works
    return { ok: true, limit: max, remaining: max, resetAt };
  }
}

/** Extract the best-effort client IP from a Request, safe against header injection. */
export function clientIp(req: Request): string {
  const raw =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    "unknown";
  // Strip anything that isn't a valid IP character to prevent key injection
  return raw.trim().replace(/[^0-9a-fA-F.:]/g, "").slice(0, 45) || "unknown";
}

/** Build a standard 429 response with Retry-After header. */
export function rateLimitResponse(resetAt: Date): Response {
  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt.getTime() / 1000)),
      },
    }
  );
}
