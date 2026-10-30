"use server";

import { getCurrentUser } from "@/lib/session";
import { rateLimitShared } from "@/lib/rate-limit-db";
import { sendEmailVerification, verifyEmailCode } from "@/lib/email-verification";

export async function resendVerification(): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again first." };
  if (!user.email) return { ok: false, error: "Add an email on the Me page first." };
  if (user.emailVerifiedAt) return { ok: false, error: "Your email is already confirmed." };
  if (!(await rateLimitShared(`verify-email:${user.id}`, 4, 60 * 60 * 1000)).ok) return { ok: false, error: "We've sent a few already. Check your inbox and spam, or try again in an hour." };
  const sent = await sendEmailVerification(user.id, user.email, user.name);
  return sent ? { ok: true, email: user.email } : { ok: false, error: "We couldn't send it just now. Try again in a few minutes." };
}

export async function confirmCode(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again first." };
  if (user.emailVerifiedAt) return { ok: true };
  const r = await verifyEmailCode(user.id, String(code).slice(0, 12));
  return r.ok ? { ok: true } : r;
}
