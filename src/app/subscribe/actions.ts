"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import type { DeliveryDay } from "@/generated/prisma/enums";

export async function startSubscription(formData: FormData) {
  const user = await getCurrentUser();
  const slug = String(formData.get("tier") ?? "");
  const deliveryDay = String(formData.get("deliveryDay") ?? "WEDNESDAY") as DeliveryDay;

  if (!user) {
    redirect(`/signup?next=${encodeURIComponent("/subscribe")}`);
  }

  const tier = await prisma.subscriptionTier.findUnique({ where: { slug } });
  if (!tier) redirect("/subscribe?error=tier");

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionTierId: tier.id, deliveryDay },
  });

  const existing = await prisma.basket.findFirst({ where: { userId: user.id, isStanding: true } });
  if (!existing) {
    await prisma.basket.create({ data: { userId: user.id, isStanding: true, deliveryDay } });
  } else {
    await prisma.basket.update({ where: { id: existing.id }, data: { deliveryDay } });
  }

  redirect("/basket");
}

export async function changeTier(slug: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const tier = await prisma.subscriptionTier.findUniqueOrThrow({ where: { slug } });
  await prisma.user.update({ where: { id: user.id }, data: { subscriptionTierId: tier.id } });
  revalidatePath("/subscribe");
  revalidatePath("/account");
}

export async function cancelSubscription() {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.user.update({ where: { id: user.id }, data: { subscriptionTierId: null } });
  revalidatePath("/subscribe");
  revalidatePath("/account");
}
