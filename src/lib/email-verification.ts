import "server-only";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-layout";
import { appOrigin } from "@/lib/site";

/*
 * Confirming an email address is the customer's: a single-use link (48
 * hours) to /verify-email, sent at sign-up and whenever the email changes.
 * Only the latest link works, and only for the address it was sent to.
 */

const TTL_MS = 48 * 60 * 60 * 1000;

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Sends a fresh link to `email` for this customer. Earlier unused links stop working. */
export async function sendEmailVerification(userId: string, email: string, name?: string | null): Promise<boolean> {
  await prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const raw = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.create({ data: { tokenHash: hash(raw), userId, email, expiresAt: new Date(Date.now() + TTL_MS) } });
  const link = `${appOrigin()}/verify-email?token=${raw}`;
  const first = name?.trim().split(/\s+/)[0];
  return sendEmail({
    to: email,
    subject: "Confirm your email for BasketNG",
    ...renderEmail({
      tag: { label: "One quick step", tone: "blue" },
      heading: first ? `${first}, confirm your email` : "Confirm your email",
      paragraphs: ["Tap below so we know this is you, and your receipts and basket reminders reach you."],
      button: { href: link, label: "Confirm my email" },
      finePrint: ["The link works for 48 hours.", "If you didn't sign up for BasketNG, ignore this email."],
    }),
  });
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
  const { count } = await prisma.emailVerificationToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count === 1) await prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
  return { ok: true, email: t.email };
}
