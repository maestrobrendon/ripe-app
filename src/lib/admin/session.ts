import "server-only";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";
import { randomToken, sha256Hex } from "./crypto";
import { isProduction } from "./config";
import type { StaffSession, StaffUser } from "@/generated/prisma/client";

/*
 * Staff sessions. The cookie carries a random token; the database keeps only
 * its sha256. A session starts "half" (password checked, second factor
 * pending, ten minutes) and becomes full when the second factor is verified,
 * at which point the token is rotated.
 *
 * Full sessions end after 30 minutes idle or 12 hours regardless. The cookie
 * is __Host- prefixed (Secure, Path=/, no Domain: it can only ever belong to
 * this exact host) and SameSite=Strict (never sent on a cross-site request).
 */

const COOKIE = isProduction() ? "__Host-basket_admin" : "basket_admin_dev";
export const HALF_SESSION_MS = 10 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const IDLE_MS = 30 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;

export type StaffContext = { session: StaffSession; staff: StaffUser };

async function setCookie(token: string, maxAgeMs: number) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

export async function clearStaffCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

async function requestMeta() {
  const h = await headers();
  return { ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** A new half session for someone who just passed the password step (or accepted an invite). */
export async function startHalfSession(staffId: string): Promise<void> {
  // Rotation: whatever admin session this browser already held is ended.
  await endCurrentSession();
  const token = randomToken();
  const meta = await requestMeta();
  await prisma.staffSession.create({
    data: {
      tokenHash: sha256Hex(token),
      staffId,
      expiresAt: new Date(Date.now() + HALF_SESSION_MS),
      csrfToken: randomToken(24),
      ...meta,
    },
  });
  await setCookie(token, HALF_SESSION_MS);
}

/**
 * The second factor checked out: promote the half session to a full one with
 * a brand-new token (the half session's token stops working), and record the
 * time as a fresh step-up.
 */
export async function completeMfa(sessionId: string): Promise<void> {
  const token = randomToken();
  const now = new Date();
  await prisma.staffSession.update({
    where: { id: sessionId },
    data: {
      tokenHash: sha256Hex(token),
      mfaVerifiedAt: now,
      stepUpAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + ABSOLUTE_MS),
      challenge: null,
      challengeExpiresAt: null,
    },
  });
  await setCookie(token, ABSOLUTE_MS);
}

/** A fresh second factor inside a full session (step-up): new token, new step-up time. */
export async function recordStepUp(sessionId: string, expiresAt: Date): Promise<void> {
  const token = randomToken();
  await prisma.staffSession.update({
    where: { id: sessionId },
    data: { tokenHash: sha256Hex(token), stepUpAt: new Date(), challenge: null, challengeExpiresAt: null },
  });
  await setCookie(token, expiresAt.getTime() - Date.now());
}

/**
 * The current staff session, if it is valid right now: not revoked, not past
 * its absolute or idle limit, and the staff member not suspended. Includes
 * half sessions (check mfaVerifiedAt). Touches lastSeenAt at most once a minute.
 */
export async function getStaffContext(): Promise<StaffContext | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const session = await prisma.staffSession.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { staff: true } });
  if (!session) return null;
  const now = Date.now();
  const idle = session.mfaVerifiedAt && now - session.lastSeenAt.getTime() > IDLE_MS;
  if (session.revokedAt || session.expiresAt.getTime() <= now || idle || session.staff.status === "SUSPENDED") {
    // Dead sessions are removed rather than left lying around.
    await prisma.staffSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await prisma.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
  }
  const { staff, ...rest } = session;
  return { session: rest, staff };
}

/** Ends this browser's admin session (sign out). */
export async function endCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await prisma.staffSession.deleteMany({ where: { tokenHash: sha256Hex(token) } }).catch(() => {});
  await clearStaffCookie().catch(() => {});
}

/** Ends every session for a staff member (password, role or MFA change; suspension; "sign out everywhere"). */
export async function revokeAllSessions(staffId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await prisma.staffSession.deleteMany({ where: { staffId, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) } });
  return count;
}

/** Store a WebAuthn challenge on the session; it expires with the ceremony. */
export async function setChallenge(sessionId: string, challenge: string): Promise<void> {
  await prisma.staffSession.update({
    where: { id: sessionId },
    data: { challenge, challengeExpiresAt: new Date(Date.now() + 5 * 60 * 1000) },
  });
}

/** Take (and clear) the pending challenge: each one can be used once. */
export async function takeChallenge(sessionId: string): Promise<string | null> {
  const s = await prisma.staffSession.findUnique({ where: { id: sessionId }, select: { challenge: true, challengeExpiresAt: true } });
  await prisma.staffSession.update({ where: { id: sessionId }, data: { challenge: null, challengeExpiresAt: null } });
  if (!s?.challenge || !s.challengeExpiresAt || s.challengeExpiresAt.getTime() < Date.now()) return null;
  return s.challenge;
}
