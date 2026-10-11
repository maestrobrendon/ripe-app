import "server-only";
import { prisma } from "@/lib/prisma";
import type { RateLimitResult } from "@/lib/rate-limit";

/**
 * A rate limit every server instance shares, for anything an attacker would
 * hammer: sign-in, MFA, invites, password reset. One atomic statement per
 * hit (insert, or increment within the window, or restart an expired one),
 * so concurrent requests can't slip past the count.
 *
 * Fails closed: if the database can't answer, the request is refused. For
 * these endpoints, "try again in a moment" beats an unmetered door.
 */
export async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const seconds = Math.ceil(windowMs / 1000);
  try {
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${seconds}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN now() + make_interval(secs => ${seconds}) ELSE "RateLimitBucket"."resetAt" END
      RETURNING "count", "resetAt"`;
    const row = rows[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
    return row.count > limit ? { ok: false, retryAfterSeconds } : { ok: true, retryAfterSeconds: 0 };
  } catch (err) {
    console.error(JSON.stringify({ scope: "rate-limit-db", error: err instanceof Error ? err.message : String(err) }));
    return { ok: false, retryAfterSeconds: 30 };
  }
}

/** Clears a key: after a successful sign-in, so earlier typos don't count against the next session. */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } }).catch(() => {});
}

/** Housekeeping: drop expired buckets. Cheap; call opportunistically. */
export async function pruneRateLimits(): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } }).catch(() => {});
}
