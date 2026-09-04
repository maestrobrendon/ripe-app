"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, destroySession } from "@/lib/session";
import { setZoneCookie } from "@/lib/zone";

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

export async function signOut() {
  await destroySession();
  redirect("/");
}
