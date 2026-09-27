"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { hashPassword, normalizeContact } from "@/lib/auth";
import { ZONE_COOKIE } from "@/lib/zone";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { GOALS } from "@/lib/assistant";
import { PRODUCE_PREFERENCE_OPTIONS } from "@/lib/format";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";
import { buildStarterPicks, getStarterCandidates } from "@/lib/starter-basket";
import { createUserBasket } from "@/lib/basket";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";

const HOUR = 60 * 60 * 1000;

const DIETARY_NOTE: Record<string, string | null> = {
  none: null,
  vegetarian: "Vegetarian",
  vegan: "Vegan",
};

function clampCount(raw: string, min: number, max: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export async function createAccountFromOnboarding(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const contact = String(formData.get("contact") ?? "").trim().slice(0, 254);
  const password = String(formData.get("password") ?? "");

  const ip = await clientIp();
  if (!rateLimit(`signup:ip:${ip}`, 5, HOUR).ok) {
    redirect("/start?error=throttled");
  }

  if (!name || !contact || password.length < 8 || password.length > 200) {
    redirect("/start?error=missing");
  }

  // Quiz answers.
  const goalSlug = GOALS.some((g) => g.slug === formData.get("goal"))
    ? String(formData.get("goal"))
    : null;

  let producePreferences: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("producePreferences") ?? "[]"));
    if (Array.isArray(parsed)) {
      producePreferences = parsed
        .filter((p): p is string => typeof p === "string")
        .filter((p) => p === "everything" || PRODUCE_PREFERENCE_OPTIONS.includes(p as never));
    }
  } catch {
    producePreferences = [];
  }

  const adults = clampCount(String(formData.get("adults") ?? "1"), 1, 12);
  const kids = clampCount(String(formData.get("kids") ?? "0"), 0, 12);

  const dietaryChoice = String(formData.get("dietary") ?? "none");
  const dietaryDetail = String(formData.get("dietaryDetail") ?? "").trim().slice(0, 400);
  const dietaryNotes =
    dietaryChoice === "allergies"
      ? dietaryDetail || "Allergies or dislikes"
      : DIETARY_NOTE[dietaryChoice] ?? null;

  const windowDay = SHOPPING_WINDOW_DAYS.some((d) => d.day === formData.get("windowDay"))
    ? (String(formData.get("windowDay")) as ShoppingWindowDay)
    : null;

  const { email, phone } = normalizeContact(contact);

  // Always hash so the "already exists" path costs the same as a real signup.
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}].filter((c) => Object.keys(c).length) },
  });
  if (existing) {
    redirect("/start?error=failed");
  }

  const store = await cookies();
  const zoneSlug = store.get(ZONE_COOKIE)?.value;
  const zone = zoneSlug ? await prisma.deliveryZone.findUnique({ where: { slug: zoneSlug } }) : null;

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email: email ?? null,
        phone: phone ?? null,
        passwordHash,
        deliveryZoneId: zone?.id ?? null,
        householdAdults: adults,
        householdKids: kids,
        shoppingWindowDay: windowDay,
        onboardingCompleted: true,
        preferences: {
          create: {
            primaryGoal: goalSlug,
            producePreferences,
            dietaryNotes,
          },
        },
      },
    });
    userId = user.id;
  } catch {
    redirect("/start?error=failed");
  }

  // The onboarding preview screen lets the member edit the suggested picks
  // before the account exists, so honour that edited list rather than
  // recomputing it blind. Falls back to a fresh recompute if it's missing or
  // malformed (e.g. JS-disabled submission).
  let picks: { productId: string; quantity: number }[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("starterPicks") ?? "[]"));
    if (Array.isArray(parsed)) {
      picks = parsed.filter(
        (p): p is { productId: string; quantity: number } =>
          p && typeof p.productId === "string" && Number.isFinite(p.quantity) && p.quantity > 0,
      );
    }
  } catch {
    picks = [];
  }
  if (picks.length === 0) {
    const candidates = await getStarterCandidates();
    picks = buildStarterPicks({ goalSlug, producePreferences, adults, kids }, candidates);
  }

  // This is the member's first basket: the free trial, permanently priced at
  // standard rates regardless of any subscription taken out afterward.
  try {
    if (picks.length > 0) {
      const basket = await createUserBasket(userId, { isSubscriber: false, deliveryDay: "WEDNESDAY" });
      if (windowDay) {
        await prisma.basket.update({ where: { id: basket.id }, data: { shoppingWindowDay: windowDay } });
      }
      await prisma.basketItem.createMany({
        data: picks.map((p) => ({ basketId: basket.id, productId: p.productId, quantity: p.quantity })),
        skipDuplicates: true,
      });
    }
  } catch {
    // A missing starter basket is recoverable later; do not block account creation.
  }

  await createSession(userId);
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") ? next : "/welcome");
}
