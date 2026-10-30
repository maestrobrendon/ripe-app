"use server";

import { redirect } from "next/navigation";
import { collectPendingClaims } from "@/lib/pending-claims";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { verifyPassword, contactWhere } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { mergeGuestCartIntoBasket } from "@/lib/order-container";

const TEN_MINUTES = 10 * 60 * 1000;

export async function signIn(formData: FormData) {
  const contact = String(formData.get("contact") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const safeNext = safeNextPath(String(formData.get("next") ?? ""), "");
  // Kept through a failed attempt: where to go after, and whether they came from checkout.
  const nextParam = (safeNext ? `&next=${encodeURIComponent(safeNext)}` : "") + (formData.get("from") === "checkout" ? "&from=checkout" : "");

  const ip = await clientIp();
  const byIp = rateLimit(`login:ip:${ip}`, 10, TEN_MINUTES);
  const byContact = rateLimit(`login:contact:${contact.toLowerCase()}`, 5, TEN_MINUTES);
  if (!byIp.ok || !byContact.ok) {
    redirect(`/login?error=throttled${nextParam}`);
  }

  const where = contactWhere(contact);
  const user = where ? await prisma.user.findFirst({ where }) : null;

  // Always run a hash comparison so a missing account is not faster to detect.
  const stored = user?.passwordHash ?? `x:${"0".repeat(128)}`;
  const valid = await verifyPassword(password, stored);

  if (!user || !user.passwordHash || !valid) {
    redirect(`/login?error=1${nextParam}`);
  }

  // Only said after a correct password, so it reveals nothing to a guesser.
  if (user.suspendedAt || user.erasedAt) redirect("/login?error=suspended");

  await createSession(user.id);
  // A gift opened, or feedback given, before signing in.
  await collectPendingClaims(user.id);
  await mergeGuestCartIntoBasket(user.id);
  // Every signed-in arrival lands on Home, this week's order.
  redirect(safeNext || "/basket");
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
