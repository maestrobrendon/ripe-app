import { prisma } from "@/lib/prisma";
import type { DeliveryDay } from "@/generated/prisma/enums";

/** Thrown when a non-subscriber who already has their one free basket tries to create another. */
export class BasketCapReachedError extends Error {
  constructor() {
    super("You've used your free basket. Subscribe to create more baskets and unlock member pricing.");
    this.name = "BasketCapReachedError";
  }
}

/** Every basket a member holds, oldest first. Non-subscribers hold at most one. */
export async function getUserBaskets(userId: string) {
  return prisma.basket.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}

/**
 * Creates a basket for the user, enforcing the free-trial cap server-side: a
 * non-subscriber gets exactly one, ever, permanently priced at standard rates
 * regardless of any subscription they take out afterward. Subscribers can
 * create as many as they like, each priced at member rates from creation.
 */
export async function createUserBasket(
  userId: string,
  { isSubscriber, deliveryDay }: { isSubscriber: boolean; deliveryDay: DeliveryDay },
) {
  if (!isSubscriber) {
    const existingCount = await prisma.basket.count({ where: { userId } });
    if (existingCount >= 1) throw new BasketCapReachedError();
  }

  const basket = await prisma.basket.create({
    data: {
      userId,
      isStanding: true,
      deliveryDay,
      isFreeTrial: !isSubscriber,
      pricingMode: isSubscriber ? "MEMBER" : "STANDARD",
    },
  });

  if (!isSubscriber) {
    await prisma.user.update({ where: { id: userId }, data: { hasCreatedFreeTrialBasket: true } });
  }
  return basket;
}

/**
 * The basket a page should show when it isn't asking for one by id: the most
 * recently touched one, or a freshly created one if the member has none yet.
 */
export async function getOrCreateActiveBasket(
  userId: string,
  { isSubscriber, deliveryDay }: { isSubscriber: boolean; deliveryDay: DeliveryDay },
) {
  const mostRecent = await prisma.basket.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (mostRecent) return mostRecent;
  return createUserBasket(userId, { isSubscriber, deliveryDay });
}

/** The member's most recently touched basket, or null. Never creates one. */
export async function getActiveBasketReadOnly(userId: string) {
  return prisma.basket.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
}

/** A specific basket by id, but only if it belongs to this user. */
export async function getOwnedBasket(userId: string, basketId: string) {
  return prisma.basket.findFirst({ where: { id: basketId, userId } });
}

/** Resolves which basket a page should act on: the requested id if it's really theirs, else the active one. */
export async function resolveActiveBasket(
  userId: string,
  requestedBasketId: string | undefined,
  opts: { isSubscriber: boolean; deliveryDay: DeliveryDay },
) {
  if (requestedBasketId) {
    const owned = await getOwnedBasket(userId, requestedBasketId);
    if (owned) return owned;
  }
  return getOrCreateActiveBasket(userId, opts);
}

/** Item count only, for lightweight surfaces like the header status line. */
export async function getBasketItemCount(basketId: string): Promise<number> {
  const items = await prisma.basketItem.aggregate({
    where: { basketId },
    _sum: { quantity: true },
  });
  return items._sum.quantity ?? 0;
}

export async function getBasketView(basketId: string) {
  const basket = await prisma.basket.findUnique({
    where: { id: basketId },
    include: {
      items: { include: { product: true }, orderBy: { product: { name: "asc" } } },
    },
  });
  if (!basket) return null;

  const memberSubtotal = basket.items.reduce((sum, i) => sum + i.product.memberPrice * i.quantity, 0);
  const standardSubtotal = basket.items.reduce((sum, i) => sum + i.product.standardPrice * i.quantity, 0);
  // Locked to the mode the basket was created under, never live subscriber status.
  const effectiveSubtotal = basket.pricingMode === "MEMBER" ? memberSubtotal : standardSubtotal;

  return {
    basket,
    memberSubtotal,
    standardSubtotal,
    effectiveSubtotal,
    savings: standardSubtotal - memberSubtotal,
  };
}

/**
 * Prefill an empty basket at the start of a shopping window. Uses the
 * member's last order if there is one, then their onboarding favorites, then
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
