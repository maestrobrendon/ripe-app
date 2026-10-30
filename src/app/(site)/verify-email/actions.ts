"use server";

import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmailVerification } from "@/lib/email-verification";

export async function resendVerification(): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again first." };
  if (!user.email) return { ok: false, error: "Add an email on the Me page first." };
  if (user.emailVerifiedAt) return { ok: false, error: "Your email is already confirmed." };
  if (!rateLimit(`verify-email:${user.id}`, 4, 60 * 60 * 1000).ok) return { ok: false, error: "We've sent a few already. Check your inbox and spam, or try again in an hour." };
  const sent = await sendEmailVerification(user.id, user.email, user.name);
  return sent ? { ok: true, email: user.email } : { ok: false, error: "We couldn't send it just now. Try again in a few minutes." };
}
