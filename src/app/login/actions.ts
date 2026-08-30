"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setCurrentUserId, clearCurrentUserId } from "@/lib/session";
import { verifyPassword, normalizeContact } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const contact = String(formData.get("contact") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const { email, phone } = normalizeContact(contact);
  const user = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((c) => Object.keys(c).length) },
  });

  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    redirect(`/login?error=1${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  }

  await setCurrentUserId(user.id);
  redirect(next || (user.onboardingCompleted ? "/account" : "/onboarding"));
}

export async function signOut() {
  await clearCurrentUserId();
  redirect("/");
}
