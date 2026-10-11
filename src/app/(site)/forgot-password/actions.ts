"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { normalizeContact } from "@/lib/auth";
import { createPasswordResetToken } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const HOUR = 60 * 60 * 1000;

async function siteOrigin(): Promise<string> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost:3000";
  const proto = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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
      const origin = await siteOrigin();
      const resetUrl = `${origin}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl);
    }
  }
  // Phone-only accounts have no delivery channel wired up yet (no SMS
  // provider configured). The response stays generic either way.

  redirect("/forgot-password?sent=1");
}
