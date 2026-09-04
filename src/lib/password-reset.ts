import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

const RESET_TTL_MINUTES = 30;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Issue a fresh reset token for a user. Any earlier unused tokens for the
 * same user are invalidated first, so only the most recent email link works.
 * Returns the raw token, which is put in the emailed link and never stored.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(rawToken), userId, expiresAt },
  });

  return rawToken;
}

/**
 * Validate a raw token from the reset link. Returns the userId if it is
 * unexpired and unused, marking it used in the same step so it cannot be
 * replayed. Returns null for anything invalid, expired, or already spent.
 */
export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) return null;

  // Mark used atomically; if another request already consumed it, count is 0.
  const result = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (result.count === 0) return null;

  return record.userId;
}
