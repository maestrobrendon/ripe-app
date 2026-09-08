"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, destroySession } from "@/lib/session";
import { setZoneCookie } from "@/lib/zone";
import { PRODUCE_PREFERENCE_OPTIONS } from "@/lib/format";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const address = String(formData.get("address") ?? "").trim().slice(0, 300);
  const zoneSlug = String(formData.get("zone") ?? "").slice(0, 100);

  const zone = zoneSlug ? await prisma.deliveryZone.findUnique({ where: { slug: zoneSlug } }) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name || user.name,
      address: address || null,
      deliveryZoneId: zone?.id ?? user.deliveryZoneId,
    },
  });

  if (zone) await setZoneCookie(zone.slug);
  revalidatePath("/account");
}

export async function updateBasketPreferences(formData: FormData) {
  const user = await requireUser();

  const clamp = (raw: FormDataEntryValue | null, min: number, max: number) => {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  };
  const adults = clamp(formData.get("adults"), 1, 12);
  const kids = clamp(formData.get("kids"), 0, 12);

  const producePreferences = formData
    .getAll("produce")
    .map(String)
    .filter((p) => PRODUCE_PREFERENCE_OPTIONS.includes(p as never));

  const windowRaw = String(formData.get("windowDay") ?? "");
  const windowDay = SHOPPING_WINDOW_DAYS.some((d) => d.day === windowRaw)
    ? (windowRaw as ShoppingWindowDay)
    : user.shoppingWindowDay;

  await prisma.user.update({
    where: { id: user.id },
    data: { householdAdults: adults, householdKids: kids, shoppingWindowDay: windowDay },
  });
  await prisma.userPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, producePreferences },
    update: { producePreferences },
  });

  revalidatePath("/account");
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
