import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort in-memory rate limiter. Effective on a warm serverless instance
 * (Vercel Fluid Compute reuses instances), but NOT shared across instances.
 * A production deployment should back this with Redis / Vercel KV / the WAF.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic prune so the map cannot grow without bound.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * The client's IP. On Vercel, from the headers Vercel itself sets
 * (x-vercel-forwarded-for, then x-real-ip), which a client can't forge: the
 * first entry of x-forwarded-for can be whatever the client sent, which would
 * let anyone pick a fresh IP per request and walk past every rate limit.
 * Off Vercel (local dev), x-forwarded-for is the best there is.
 */
export async function clientIp(): Promise<string> {
  const store = await headers();
  const vercel = store.get("x-vercel-forwarded-for") ?? store.get("x-real-ip");
  if (process.env.VERCEL) return vercel?.split(",")[0]!.trim() || "unknown";
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return vercel?.trim() || "unknown";
}
