import { prisma } from "@/lib/prisma";
import type { DeliveryDay } from "@/generated/prisma/enums";

export async function getOrCreateStandingBasket(userId: string, deliveryDay: DeliveryDay) {
  const existing = await prisma.basket.findFirst({
    where: { userId, isStanding: true },
    include: { items: { include: { product: true } } },
  });
  if (existing) return existing;

  return prisma.basket.create({
    data: { userId, isStanding: true, deliveryDay },
    include: { items: { include: { product: true } } },
  });
}

export async function getStandingBasketView(userId: string) {
  const basket = await prisma.basket.findFirst({
    where: { userId, isStanding: true },
    include: { items: { include: { product: true } }, user: { include: { subscriptionTier: true } } },
  });
  if (!basket) return null;

  const memberSubtotal = basket.items.reduce((sum, i) => sum + i.product.memberPrice * i.quantity, 0);
  const marketSubtotal = basket.items.reduce((sum, i) => sum + i.product.marketPrice * i.quantity, 0);

  return { basket, memberSubtotal, marketSubtotal };
}
