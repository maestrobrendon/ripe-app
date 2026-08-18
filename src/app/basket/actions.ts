"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { DeliveryDay } from "@/generated/prisma/enums";

export async function setBasketDeliveryDay(deliveryDay: DeliveryDay) {
  const user = await requireUser();
  const basket = await prisma.basket.findFirst({ where: { userId: user.id, isStanding: true } });
  if (!basket) return;

  await prisma.basket.update({ where: { id: basket.id }, data: { deliveryDay } });
  revalidatePath("/basket");
}
