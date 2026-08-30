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
    include: {
      items: { include: { product: true }, orderBy: { product: { name: "asc" } } },
      user: { include: { subscriptionTier: true } },
    },
  });
  if (!basket) return null;

  const memberSubtotal = basket.items.reduce((sum, i) => sum + i.product.memberPrice * i.quantity, 0);
  const standardSubtotal = basket.items.reduce((sum, i) => sum + i.product.standardPrice * i.quantity, 0);

  return { basket, memberSubtotal, standardSubtotal, savings: standardSubtotal - memberSubtotal };
}

/**
 * Prefill an empty standing basket at the start of a shopping window. Uses the
 * subscriber's last order if there is one, then their onboarding favorites, then
 * a seasonal starter mix.
 */
export async function prefillStandingBasket(userId: string, basketId: string) {
  const count = await prisma.basketItem.count({ where: { basketId } });
  if (count > 0) return;

  const [lastOrder, prefs] = await Promise.all([
    prisma.order.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, include: { items: true } }),
    prisma.userPreferences.findUnique({ where: { userId } }),
  ]);

  let picks: { productId: string; quantity: number }[] = [];

  if (lastOrder && lastOrder.items.length > 0) {
    picks = lastOrder.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  } else if (prefs && prefs.favoriteProductIds.length > 0) {
    const favs = await prisma.product.findMany({ where: { id: { in: prefs.favoriteProductIds } } });
    picks = favs.map((p) => ({ productId: p.id, quantity: p.minOrderQty }));
  } else {
    const seasonal = await prisma.product.findMany({ where: { featured: true, inSeason: true }, take: 6 });
    picks = seasonal.map((p) => ({ productId: p.id, quantity: p.minOrderQty }));
  }

  if (picks.length === 0) return;

  await prisma.basketItem.createMany({
    data: picks.map((p) => ({ basketId, ...p })),
    skipDuplicates: true,
  });
}
