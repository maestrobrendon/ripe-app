"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setCurrentUserId } from "@/lib/session";
import type { DeliveryDay } from "@/generated/prisma/enums";

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const zoneSlug = String(formData.get("zone") ?? "");
  const deliveryDay = String(formData.get("deliveryDay") ?? "MONDAY") as DeliveryDay;
  const tierSlug = String(formData.get("tier") ?? "base");

  if (!name || !phone || !address || !zoneSlug) {
    throw new Error("Please fill in name, phone, address and delivery zone.");
  }

  const [zone, tier] = await Promise.all([
    prisma.zone.findUniqueOrThrow({ where: { slug: zoneSlug } }),
    prisma.subscriptionTier.findUniqueOrThrow({ where: { slug: tierSlug } }),
  ]);

  if (emailRaw) {
    const emailOwner = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (emailOwner && emailOwner.phone !== phone) {
      redirect(`/signup?tier=${tierSlug}&error=email-taken`);
    }
  }

  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      name,
      email: emailRaw || null,
      address,
      zoneId: zone.id,
      subscriptionTierId: tier.id,
      deliveryDay,
    },
    create: {
      name,
      phone,
      email: emailRaw || null,
      address,
      zoneId: zone.id,
      subscriptionTierId: tier.id,
      deliveryDay,
    },
  });

  const existingBasket = await prisma.basket.findFirst({ where: { userId: user.id, isStanding: true } });
  if (!existingBasket) {
    await prisma.basket.create({ data: { userId: user.id, isStanding: true, deliveryDay } });
  }

  await setCurrentUserId(user.id);
  redirect("/shop");
}
