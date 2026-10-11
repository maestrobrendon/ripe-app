"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { verifyPassword, normalizeContact } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const TEN_MINUTES = 10 * 60 * 1000;

export async function signIn(formData: FormData) {
  const contact = String(formData.get("contact") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const safeNext = safeNextPath(String(formData.get("next") ?? ""), "");
  const nextParam = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";

  const ip = await clientIp();
  const byIp = rateLimit(`login:ip:${ip}`, 10, TEN_MINUTES);
  const byContact = rateLimit(`login:contact:${contact.toLowerCase()}`, 5, TEN_MINUTES);
  if (!byIp.ok || !byContact.ok) {
    redirect(`/login?error=throttled${nextParam}`);
  }

  const { email, phone } = normalizeContact(contact);
  const user = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((c) => Object.keys(c).length) },
  });

  // Always run a hash comparison so a missing account is not faster to detect.
  const stored = user?.passwordHash ?? `x:${"0".repeat(128)}`;
  const valid = await verifyPassword(password, stored);

  if (!user || !user.passwordHash || !valid) {
    redirect(`/login?error=1${nextParam}`);
  }

  await createSession(user.id);
  redirect(safeNext || (user.onboardingCompleted ? "/account" : "/onboarding"));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
