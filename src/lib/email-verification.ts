import "server-only";
import { randomBytes, randomInt, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-layout";
import { rateLimitShared, resetRateLimit } from "@/lib/rate-limit-db";
import { appOrigin } from "@/lib/site";

/*
 * Confirming an email address is the customer's. Each email carries both a
 * 6-digit code (typed on /verify-email, 30 minutes) and a single-use link
 * (48 hours), sent at sign-up and whenever the email changes. Only the
 * latest email works, and only for the address it was sent to.
 *
 * Both live in EmailVerificationToken: the link as a hash of its token, the
 * code as a hash of the code with the customer's id, so a code only ever
 * matches its own account. Wrong guesses are capped per customer.
 */

const LINK_TTL_MS = 48 * 60 * 60 * 1000;
const CODE_TTL_MS = 30 * 60 * 1000;
const MAX_TRIES = 5;

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const codeHash = (userId: string, code: string) => hash(`code:${userId}:${code}`);
const triesKey = (userId: string) => `verify-code:${userId}`;

/** Sends a fresh code and link to `email` for this customer. Earlier unused ones stop working. */
export async function sendEmailVerification(userId: string, email: string, name?: string | null): Promise<boolean> {
  await prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const raw = randomBytes(32).toString("base64url");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.emailVerificationToken.createMany({
    data: [
      { tokenHash: hash(raw), userId, email, expiresAt: new Date(Date.now() + LINK_TTL_MS) },
      { tokenHash: codeHash(userId, code), userId, email, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    ],
  });
  await resetRateLimit(triesKey(userId));
  const link = `${appOrigin()}/verify-email?token=${raw}`;
  const first = name?.trim().split(/\s+/)[0];
  return sendEmail({
    to: email,
    // The code up front, so it can be read from the notification alone.
    subject: `${code} is your BasketNG code`,
    ...renderEmail({
      tag: { label: "One quick step", tone: "blue" },
      heading: first ? `${first}, here's your code` : "Here's your code",
      paragraphs: ["Type it into BasketNG to confirm this is your email, so your receipts and basket reminders reach you."],
      code,
      preheader: `${code} confirms your email. It works for 30 minutes.`,
      button: { href: link, label: "Or confirm with one tap" },
      finePrint: ["The code works for 30 minutes, the button for 48 hours.", "If you didn't sign up for BasketNG, ignore this email. Never share this code with anyone."],
    }),
  });
}

/** Whether a code was sent in the last 30 minutes and is still waiting to be typed. */
export async function hasLiveCode(userId: string): Promise<boolean> {
  const n = await prisma.emailVerificationToken.count({ where: { userId, usedAt: null, expiresAt: { gt: new Date() }, createdAt: { gt: new Date(Date.now() - CODE_TTL_MS) } } });
  return n > 0;
}

async function confirm(tokenId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.emailVerificationToken.updateMany({ where: { id: tokenId, usedAt: null }, data: { usedAt: new Date() } });
  if (count !== 1) return false;
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  // The other half of the email (code or link) has nothing left to do.
  await prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  return true;
}

export type CodeResult = { ok: true; email: string } | { ok: false; error: string };

/** A typed code, for the signed-in customer it was sent to. */
export async function verifyEmailCode(userId: string, input: string): Promise<CodeResult> {
  const code = input.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Enter all 6 digits." };
  if (!(await rateLimitShared(triesKey(userId), MAX_TRIES, CODE_TTL_MS)).ok) return { ok: false, error: "Too many tries. Send yourself a new code." };
  const t = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: codeHash(userId, code) }, include: { user: { select: { email: true } } } });
  if (!t || t.usedAt || t.userId !== userId) return { ok: false, error: "That code isn't right. Check the newest email and try again." };
  if (t.expiresAt.getTime() < Date.now()) return { ok: false, error: "That code has expired. Send yourself a new one." };
  if (t.user.email !== t.email) return { ok: false, error: "Your email has changed since. Send a code to the new one." };
  await confirm(t.id, userId);
  await resetRateLimit(triesKey(userId));
  return { ok: true, email: t.email };
}

export type VerifyResult = { ok: true; email: string } | { ok: false; reason: "invalid" | "expired" | "changed" };

/** Opens a link: marks the address confirmed if it's still the one on the account. */
export async function verifyEmailToken(raw: string): Promise<VerifyResult> {
  if (!raw) return { ok: false, reason: "invalid" };
  const t = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hash(raw) }, include: { user: { select: { email: true, emailVerifiedAt: true } } } });
  if (!t) return { ok: false, reason: "invalid" };
  // Opened twice (or by a mail scanner first): still fine if it confirmed this address.
  if (t.usedAt) return t.user.emailVerifiedAt && t.user.email === t.email ? { ok: true, email: t.email } : { ok: false, reason: "invalid" };
  if (t.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (t.user.email !== t.email) return { ok: false, reason: "changed" };
  await confirm(t.id, t.userId);
  return { ok: true, email: t.email };
}
