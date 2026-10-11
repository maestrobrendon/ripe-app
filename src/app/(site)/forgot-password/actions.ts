"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeContact } from "@/lib/auth";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { appOrigin } from "@/lib/site";

const HOUR = 60 * 60 * 1000;

export async function requestPasswordReset(formData: FormData) {
  const contact = String(formData.get("contact") ?? "").trim();

  const ip = await clientIp();
  const byIp = rateLimit(`reset-request:ip:${ip}`, 5, HOUR);
  const byContact = rateLimit(`reset-request:contact:${contact.toLowerCase()}`, 3, HOUR);

  // Always land on the same "check your inbox" screen, whether the account
  // exists, is throttled, or has no email on file. Never confirm or deny.
  if (!byIp.ok || !byContact.ok || !contact) {
    redirect("/forgot-password?sent=1");
  }

  const { email } = normalizeContact(contact);
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = await createPasswordResetToken(user.id);
      const resetUrl = `${appOrigin()}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl);
    }
  }
  // Phone-only accounts have no delivery channel wired up yet (no SMS
  // provider configured). The response stays generic either way.

  redirect("/forgot-password?sent=1");
}
