"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, clearCurrentUserId } from "@/lib/session";
import { setZoneCookie } from "@/lib/zone";

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const zoneSlug = String(formData.get("zone") ?? "");

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

export async function signOut() {
  await clearCurrentUserId();
  redirect("/");
}
