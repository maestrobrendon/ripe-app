"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { createSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const TEN_MINUTES = 10 * 60 * 1000;

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const ip = await clientIp();
  if (!rateLimit(`reset-confirm:ip:${ip}`, 10, TEN_MINUTES).ok) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=throttled`);
  }

  if (password.length < 8 || password.length > 200 || password !== confirm) {
    redirect(`/reset-password?token=${encodeURIComponent(token)}&error=invalid`);
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    redirect("/reset-password?error=expired");
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // A password reset is a good moment to sign every other session out too,
  // in case the reset was prompted by a lost/compromised device.
  await prisma.session.deleteMany({ where: { userId } });

  await createSession(userId);
  redirect("/account");
}
