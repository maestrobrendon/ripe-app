"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, destroySession, destroyAllSessions, endOtherSessions } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { sendContactChangedEmail } from "@/lib/email";
import { normalizePhone, phoneVariants } from "@/lib/phone";
import { MENU_GOALS } from "@/lib/menu-types";
import { PRODUCE_PREFERENCE_OPTIONS } from "@/lib/format";
import { audit } from "@/lib/admin/audit";
import { getSiteSettings } from "@/lib/site-settings";
import { notify } from "@/lib/notify";

export type SaveResult = { ok: true } | { ok: false; error: string };

function done(): SaveResult {
  revalidatePath("/account");
  return { ok: true };
}

const GOAL_SLUGS = new Set(MENU_GOALS.map((g) => g.starterSlug));

export async function saveContact(input: { name: string; phone: string; email: string; currentPassword?: string }): Promise<SaveResult> {
  const user = await requireUser();
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Add your name, so riders know who to ask for." };

  const rawPhone = input.phone.trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { ok: false, error: "That phone number doesn't look right. Try 0803 123 4567." };
  const email = input.email.trim().toLowerCase().slice(0, 254) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email doesn't look right." };
  // Phone and email are how you sign in and get your password back: keep at least one.
  if (!phone && !email) return { ok: false, error: "Keep a phone number or an email, so you can still sign in." };

  // Changing them needs the password: a stolen session alone can't take over the account.
  const contactChanged = email !== (user.email ?? null) || phone !== (user.phone ?? null);
  if (contactChanged) {
    if (!rateLimit(`contact-change:${user.id}`, 5, 10 * 60 * 1000).ok) return { ok: false, error: "Too many tries. Wait a few minutes." };
    if (!user.passwordHash) return { ok: false, error: "Set a password first: use Forgot password on the sign-in page." };
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash))) return { ok: false, error: "That password isn't right." };
  }

  const clash = await prisma.user.findFirst({
    where: { id: { not: user.id }, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone: { in: phoneVariants(phone) } }] : [])] },
    select: { id: true },
  });
  // Neutral wording: this form shouldn't confirm whose details are registered.
  if (clash) return { ok: false, error: "That email or phone number can't be used. Try another." };

  await prisma.user.update({ where: { id: user.id }, data: { name, phone, email } });
  if (contactChanged) {
    await endOtherSessions(user.id);
    if (user.email && user.email !== email) await sendContactChangedEmail(user.email).catch(() => {});
  }
  return done();
}

/** Food and household: the six goals, who's eating, what they usually buy, and what to avoid. */
export async function savePreferences(input: { adults: number; kids: number; goal: string; likes: string[]; dietaryNotes: string }): Promise<SaveResult> {
  const user = await requireUser();
  if (!GOAL_SLUGS.has(input.goal)) return { ok: false, error: "Pick what you're after most." };
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(n) || 0)));
  const producePreferences = input.likes.filter((l) => PRODUCE_PREFERENCE_OPTIONS.includes(l as never));
  const dietaryNotes = input.dietaryNotes.trim().slice(0, 400) || null;

  await prisma.user.update({ where: { id: user.id }, data: { householdAdults: clamp(input.adults, 1, 12), householdKids: clamp(input.kids, 0, 12) } });
  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, primaryGoal: input.goal, producePreferences, dietaryNotes },
    update: { primaryGoal: input.goal, producePreferences, dietaryNotes },
  });
  return done();
}

/** Where order updates and weekly reminders go. Password links are always sent. */
export async function setNotifyChannel(channel: "whatsapp" | "email", on: boolean): Promise<SaveResult> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: channel === "whatsapp" ? { notifyWhatsApp: on } : { notifyEmail: on } });
  return done();
}

export async function setKachiReviewConsent(on: boolean): Promise<SaveResult> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { kachiReviewConsentAt: on ? new Date() : null } });
  await audit({ actorType: "CUSTOMER", actorId: user.id, action: on ? "privacy.kachi_review_on" : "privacy.kachi_review_off", targetType: "User", targetId: user.id }).catch(() => {});
  return done();
}

/**
 * "Delete my account": a request staff complete within 30 days (open orders
 * and payments are settled first). It can be withdrawn until then.
 */
export async function requestDeletion(): Promise<SaveResult> {
  const user = await requireUser();
  const open = await prisma.order.count({ where: { userId: user.id, status: { in: ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY"] } } });
  if (open) return { ok: false, error: "You have an order on its way. Ask again after it arrives, or cancel it first." };
  await prisma.user.update({ where: { id: user.id }, data: { deletionRequestedAt: new Date() } });
  await audit({ actorType: "CUSTOMER", actorId: user.id, action: "privacy.deletion_requested", targetType: "User", targetId: user.id }).catch(() => {});
  const settings = await getSiteSettings();
  await notify({ userId: null, kind: "privacy.deletion_requested", dedupeKey: `deletion:${user.id}:${new Date().toISOString().slice(0, 10)}`, essential: true, email: { to: settings.support.email, subject: "Account deletion request", text: `Customer ${user.id} asked for their account to be deleted. Find them under Customers in the admin.` } }).catch(() => {});
  return done();
}

export async function cancelDeletion(): Promise<SaveResult> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { deletionRequestedAt: null } });
  await audit({ actorType: "CUSTOMER", actorId: user.id, action: "privacy.deletion_withdrawn", targetType: "User", targetId: user.id }).catch(() => {});
  return done();
}

export async function signOut() {
  await destroySession();
  redirect("/");
}

/** Sign out on every device: for a lost phone or a shared computer. */
export async function signOutEverywhere() {
  const user = await requireUser();
  await destroyAllSessions(user.id);
  redirect("/");
}
