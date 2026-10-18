import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isBuyable, isOffered, snapQuantity } from "@/lib/product";
import { basketLimitFor, BasketCapReachedError } from "@/lib/basket";
import { dayIn, zoneForUser } from "@/lib/delivery";
import type { CurrentUser } from "@/lib/session";
import type { DeliveryDay } from "@/generated/prisma/enums";

/*
 * One container. A signed-in customer never has a cart: they have deliveries
 * (the Basket table), and whatever they add, from any page, goes into the one
 * they're looking at, the "active" delivery. A guest's cookie cart moves into
 * it when they sign in or sign up. Prices follow membership live: members pay
 * member prices on every delivery, everyone else standard prices.
 */

export const ACTIVE_DELIVERY_COOKIE = "basket_active";

/** A message that's safe and useful to show the customer as it is. */
export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

type UserLike = Pick<CurrentUser, "id" | "subscriptionTierId" | "deliveryDay"> & { subscriptionTier?: { slug: string } | null };

export const isMember = (u: Pick<CurrentUser, "subscriptionTierId"> | null | undefined) => Boolean(u?.subscriptionTierId);

/** The price this customer pays for a product, now. */
export const priceFor = (p: { memberPrice: number; standardPrice: number }, member: boolean) => (member ? p.memberPrice : p.standardPrice);

/** The delivery the customer is looking at: the one in the cookie if it's theirs, else the most recently touched. Never creates one. Once per render. */
export const readActiveDelivery = cache(async (userId: string) => {
  const wanted = (await cookies()).get(ACTIVE_DELIVERY_COOKIE)?.value;
  if (wanted) {
    const owned = await prisma.basket.findFirst({ where: { id: wanted, userId } });
    if (owned) return owned;
  }
  return prisma.basket.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
});

/** Remember which delivery the customer is looking at. Route handlers and server actions only. */
export async function rememberActiveDelivery(basketId: string) {
  (await cookies()).set(ACTIVE_DELIVERY_COOKIE, basketId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

/** The active delivery, creating the customer's first one if they have none. */
export async function getOrCreateActiveDelivery(user: UserLike) {
  const existing = await readActiveDelivery(user.id);
  if (existing) return existing;
  const zone = await zoneForUser(user.id);
  return prisma.basket.create({
    data: {
      userId: user.id,
      isStanding: isMember(user),
      deliveryDay: dayIn(zone, user.deliveryDay ?? zone?.deliveryDays[0] ?? "FRIDAY"),
      pricingMode: isMember(user) ? "MEMBER" : "STANDARD",
    },
  });
}

/** A delivery by id, only if it's this customer's. */
export async function ownedDelivery(userId: string, basketId: string | null | undefined) {
  if (!basketId) return null;
  return prisma.basket.findFirst({ where: { id: basketId, userId } });
}

/**
 * Another delivery ("For Mum", Saturdays). Members can hold several (Member
 * three, Member Plus any number); everyone else has one.
 */
export async function createDelivery(user: UserLike, input: { name: string; day: DeliveryDay }) {
  const limit = basketLimitFor(isMember(user), user.subscriptionTier?.slug);
  if (limit !== null && (await prisma.basket.count({ where: { userId: user.id } })) >= limit) {
    throw new BasketCapReachedError(isMember(user) ? "member" : "trial");
  }
  const zone = await zoneForUser(user.id);
  return prisma.basket.create({
    data: {
      userId: user.id,
      name: input.name.trim().slice(0, 40) || null,
      isStanding: isMember(user),
      deliveryDay: dayIn(zone, input.day),
      pricingMode: isMember(user) ? "MEMBER" : "STANDARD",
    },
  });
}

/**
 * The one place a delivery line is written. `mode: "set"` puts the line at
 * that quantity; `"add"` adds on top of what's there (so "Add" from the shop
 * never overwrites three tomatoes with one). Quantities snap to the product's
 * pack size. Out-of-stock and discontinued products throw an OrderError.
 */
export async function writeDeliveryLine(basketId: string, productId: string, quantity: number, mode: "set" | "add" = "set") {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new OrderError("We couldn't find that item.");
  const existing = await prisma.basketItem.findUnique({ where: { basketId_productId: { basketId, productId } } });
  const wanted = mode === "add" ? (existing?.quantity ?? 0) + Math.max(0, quantity) : quantity;

  if (wanted <= 0) {
    await prisma.basketItem.deleteMany({ where: { basketId, productId } });
    await prisma.basket.update({ where: { id: basketId }, data: { updatedAt: new Date() } });
    return { productId, name: product.name, quantity: 0 };
  }
  if (!isOffered(product)) throw new OrderError(`We don't sell ${product.name} any more.`);
  if (!isBuyable(product)) throw new OrderError(`${product.name} is sold out right now. We'll have more soon.`);

  const snapped = snapQuantity(wanted, product);
  await prisma.basketItem.upsert({
    where: { basketId_productId: { basketId, productId } },
    update: { quantity: snapped },
    create: { basketId, productId, quantity: snapped },
  });
  await prisma.basket.update({ where: { id: basketId }, data: { updatedAt: new Date() } });
  return { productId, name: product.name, quantity: snapped };
}

/** Add several products on top of what a delivery already holds, skipping anything we can't sell. */
export async function addLinesToDelivery(basketId: string, lines: { productId: string; quantity: number }[]) {
  let added = 0;
  for (const l of lines.slice(0, 60)) {
    try {
      const r = await writeDeliveryLine(basketId, l.productId, l.quantity, "add");
      if (r.quantity > 0) added++;
    } catch (e) {
      if (!(e instanceof OrderError)) throw e;
    }
  }
  return added;
}

/**
 * Moves a guest's cookie cart into the customer's active delivery when they
 * sign in or sign up, then empties it. Quantities add to what's there.
 */
export async function mergeGuestCartIntoBasket(userId: string) {
  const token = (await cookies()).get("ripe_cart")?.value;
  if (!token) return;
  const cart = await prisma.cart.findUnique({ where: { token }, include: { items: true } });
  if (!cart || cart.items.length === 0 || (cart.userId && cart.userId !== userId)) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, subscriptionTierId: true, deliveryDay: true, subscriptionTier: { select: { slug: true } } } });
  if (!user) return;
  const delivery = await getOrCreateActiveDelivery(user);
  await addLinesToDelivery(delivery.id, cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}
