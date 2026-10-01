"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, destroySession } from "@/lib/session";
import { setZoneCookie } from "@/lib/zone";
import { GOALS } from "@/lib/assistant";
import { PRODUCE_PREFERENCE_OPTIONS } from "@/lib/format";

export type SaveResult = { ok: true } | { ok: false; error: string };

function done(): SaveResult {
  revalidatePath("/account");
  return { ok: true };
}

export async function saveAddress(input: { address: string; zoneSlug: string }): Promise<SaveResult> {
  const user = await requireUser();
  const address = input.address.trim().slice(0, 300);
  if (!address) return { ok: false, error: "Add your street and area" };
  const zone = input.zoneSlug ? await prisma.deliveryZone.findUnique({ where: { slug: input.zoneSlug } }) : null;
  if (!zone || !zone.isServed) return { ok: false, error: "Add your street and area" };

  await prisma.user.update({ where: { id: user.id }, data: { address, deliveryZoneId: zone.id } });
  await setZoneCookie(zone.slug);
  return done();
}

export async function saveContact(input: { name: string; phone: string; email: string }): Promise<SaveResult> {
  const user = await requireUser();
  const name = input.name.trim().slice(0, 120) || user.name;
  const phone = input.phone.trim().slice(0, 32) || null;
  const email = input.email.trim().toLowerCase().slice(0, 254) || user.email;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email doesn't look right" };

  const clash = await prisma.user.findFirst({
    where: {
      id: { not: user.id },
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    },
    select: { email: true },
  });
  if (clash) {
    return { ok: false, error: clash.email === email ? "That email is on another account" : "That phone number is on another account" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { name, phone, email } });
  return done();
}

/**
 * The one food-preferences record: household size on the user, goal and
 * usual produce on UserPreferences. Kachi, the Produce list and the
 * onboarding survey all read these same fields.
 */
export async function savePreferences(input: {
  adults: number;
  kids: number;
  goal: string;
  likes: string[];
}): Promise<SaveResult> {
  const user = await requireUser();
  if (!GOALS.some((g) => g.slug === input.goal)) return { ok: false, error: "Pick what you want most" };
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(n) || 0)));
  const producePreferences = input.likes.filter((l) => PRODUCE_PREFERENCE_OPTIONS.includes(l as never));

  await prisma.user.update({
    where: { id: user.id },
    data: { householdAdults: clamp(input.adults, 1, 10), householdKids: clamp(input.kids, 0, 10) },
  });
  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, primaryGoal: input.goal, producePreferences },
    update: { primaryGoal: input.goal, producePreferences },
  });
  return done();
}

function cardBrand(digits: string) {
  if (/^4/.test(digits)) return "VISA";
  if (/^(5061|5078|5079|650)/.test(digits)) return "VERVE";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "MC";
  return "CARD";
}

/** Test mode: keeps only brand, last four and expiry. No payment provider, no money moves. */
export async function addTestCard(input: { number: string; expiry: string }): Promise<SaveResult> {
  const user = await requireUser();
  const digits = input.number.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return { ok: false, error: "That card number doesn't look right" };
  const m = input.expiry.trim().match(/^(\d{1,2})\s*\/\s*(\d{2})$/);
  const month = m ? Number(m[1]) : 0;
  if (!m || month < 1 || month > 12) return { ok: false, error: "Use MM/YY for the expiry" };
  const expiresEnd = new Date(2000 + Number(m[2]), month, 1);
  if (expiresEnd <= new Date()) return { ok: false, error: "That card has expired" };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      paymentCardBrand: cardBrand(digits),
      paymentCardLast4: digits.slice(-4),
      paymentCardExpiry: `${String(month).padStart(2, "0")}/${m[2]}`,
    },
  });
  return done();
}

export async function removeCard(): Promise<SaveResult> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { paymentCardBrand: null, paymentCardLast4: null, paymentCardExpiry: null },
  });
  return done();
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
