"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { hashPassword, normalizeContact } from "@/lib/auth";
import { ZONE_COOKIE } from "@/lib/zone";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { buildStarterPicks, getStarterCandidates } from "@/lib/starter-basket";
import { createUserBasket } from "@/lib/basket";
import { safeNextPath } from "@/lib/safe-redirect";
import { appOrigin } from "@/lib/site";
import { sendSignupAttemptEmail } from "@/lib/email";
import { BUYABLE } from "@/lib/product";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { MENU, MENU_GOALS } from "../home-menu/recipes";

const HOUR = 60 * 60 * 1000;

const DIETARY_NOTE: Record<string, string | null> = {
  none: null,
  vegetarian: "Vegetarian",
  vegan: "Vegan",
};

export type StartState = { error: "missing" | "failed" | "throttled" | null };

function clampCount(raw: unknown, min: number, max: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function parseJson<T>(raw: unknown, fallback: T): T {
  try {
    return JSON.parse(String(raw ?? "")) as T;
  } catch {
    return fallback;
  }
}

/**
 * The last screen of /start. Returns an error for the form to show (so every
 * answer on the screens before it survives a typo) and redirects on success.
 */
export async function createAccountFromOnboarding(_prev: StartState, formData: FormData): Promise<StartState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 254);
  const password = String(formData.get("password") ?? "");

  const ip = await clientIp();
  if (!rateLimit(`signup:ip:${ip}`, 5, HOUR).ok) return { error: "throttled" };
  if (!name || !contact || password.length < 8 || password.length > 200) return { error: "missing" };

  // The goal comes in as the homepage's id ("lighter"); the account keeps the slug.
  const goalSlug = MENU_GOALS.find((g) => g.id === formData.get("goal"))?.starterSlug ?? null;
  const adults = clampCount(formData.get("adults"), 1, 12);
  const kids = clampCount(formData.get("kids"), 0, 12);

  const dietaryChoice = String(formData.get("dietary") ?? "none");
  const dietaryDetail = String(formData.get("dietaryDetail") ?? "").trim().slice(0, 400);
  const dietaryNotes =
    dietaryChoice === "allergies" ? dietaryDetail || "Allergies or dislikes" : (DIETARY_NOTE[dietaryChoice] ?? null);

  // A served zone and one of its own delivery days. Someone in an area we
  // don't reach yet still gets an account and their week, with no zone set.
  const zoneSlug = String(formData.get("zone") ?? "") || (await cookies()).get(ZONE_COOKIE)?.value || "";
  const found = zoneSlug ? await prisma.deliveryZone.findUnique({ where: { slug: zoneSlug } }) : null;
  const zone = found?.isServed ? found : null;
  const requestedDay = String(formData.get("deliveryDay") ?? "") as DeliveryDay;
  const deliveryDay: DeliveryDay =
    zone && zone.deliveryDays.includes(requestedDay) ? requestedDay : (zone?.deliveryDays[0] ?? "WEDNESDAY");

  const { email, phone } = normalizeContact(contact);

  // Always hash so the "already exists" path costs the same as a real signup.
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((c) => Object.keys(c).length) },
  });
  if (existing) {
    // Same answer as any other failure, so the form can't be used to find out
    // who has an account. The owner of the address is told by email instead.
    if (existing.email) await sendSignupAttemptEmail(existing.email, appOrigin()).catch(() => {});
    return { error: "failed" };
  }

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email: email ?? null,
        phone: phone ?? null,
        passwordHash,
        deliveryZoneId: zone?.id ?? null,
        deliveryDay,
        householdAdults: adults,
        householdKids: kids,
        onboardingCompleted: true,
        preferences: { create: { primaryGoal: goalSlug, producePreferences: [], dietaryNotes } },
      },
    });
    userId = user.id;
  } catch {
    return { error: "failed" };
  }

  // The basket the customer built from their recipes on the preview screen.
  // Falls back to the goal's starter basket if it's missing or malformed.
  let picks = parseJson<unknown[]>(formData.get("items"), [])
    .filter(
      (p): p is { productId: string; quantity: number } =>
        Boolean(p) &&
        typeof (p as { productId?: unknown }).productId === "string" &&
        Number.isFinite((p as { quantity?: unknown }).quantity) &&
        (p as { quantity: number }).quantity > 0,
    )
    .slice(0, 60)
    .map((p) => ({ productId: p.productId, quantity: Math.min(50, Math.round(p.quantity)) }));
  // Only products we still sell, whatever the form claimed.
  if (picks.length > 0) {
    const sold = new Set(
      (await prisma.product.findMany({ where: { id: { in: picks.map((p) => p.productId) }, ...BUYABLE }, select: { id: true } })).map((p) => p.id),
    );
    picks = picks.filter((p) => sold.has(p.productId));
  }
  if (picks.length === 0) {
    picks = buildStarterPicks({ goalSlug, producePreferences: [], adults, kids }, await getStarterCandidates());
  }

  // This is the member's first basket: the free trial, permanently priced at
  // standard rates regardless of any subscription taken out afterward.
  try {
    if (picks.length > 0) {
      const basket = await createUserBasket(userId, { isSubscriber: false, deliveryDay });
      await prisma.basketItem.createMany({
        data: picks.map((p) => ({ basketId: basket.id, productId: p.productId, quantity: p.quantity })),
        skipDuplicates: true,
      });
    }
  } catch {
    // A missing starter basket is recoverable later; do not block account creation.
  }

  await createSession(userId);

  // The welcome screen shows the week they picked; recipe slugs are not personal.
  const picked = parseJson<unknown[]>(formData.get("recipes"), [])
    .filter((s): s is string => typeof s === "string" && MENU.some((r) => r.slug === s))
    .slice(0, 8);
  redirect(safeNextPath(String(formData.get("next") ?? ""), `/welcome${picked.length ? `?recipes=${picked.join(",")}` : ""}`));
}
