import "server-only";
import { isOffered, isBuyable, snapQuantity } from "@/lib/product";
import { BASE_DELIVERY_FEE, hasFreeDelivery } from "@/lib/pricing";
import { getSiteSettings } from "@/lib/site-settings";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOrCreateActiveDelivery, readActiveDelivery, writeDeliveryLine, OrderError } from "@/lib/order-container";
import { zoneForUser } from "@/lib/delivery";
import { orderPhrase } from "@/lib/delivery-labels";

/*
 * What the customer is filling, as one view for every page and the header.
 * A guest fills a cookie cart. A signed-in customer has no cart: the same view
 * and the same writes go to the delivery they're looking at (see
 * order-container.ts), so the shop, recipes and Kachi all fill one order.
 */

const CART_COOKIE = "ripe_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type CartLineView = {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  orderUnit: string;
  minOrderQty: number;
  stepQty: number;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  memberPrice: number;
  standardPrice: number;
  quantity: number;
  /** Staff marked it out of stock (or stopped selling it): it won't be in the order. */
  soldOut: boolean;
  /** Short supply this week. */
  limited: boolean;
};

export type CartView = {
  items: CartLineView[];
  subtotal: number;
  standardSubtotal: number;
  memberSubtotal: number;
  savingsIfMember: number;
  itemCount: number;
  isSubscriber: boolean;
  /** On a plan that includes delivery (Member Plus). */
  freeDelivery: boolean;
  /** The customer's area fee, or the default when no area is known. */
  deliveryFee: number;
  /** Order value for free delivery (a site setting). */
  freeDeliveryThreshold: number;
  /** "cart" for a guest; "delivery" for a signed-in customer. */
  container: "cart" | "delivery";
  /** The delivery being filled, for a signed-in customer. */
  deliveryId: string | null;
  /** How it reads in a sentence: "your Wednesday order". */
  deliveryLabel: string | null;
};

type Who = Pick<CartView, "isSubscriber" | "freeDelivery" | "deliveryFee" | "freeDeliveryThreshold">;
type Container = Pick<CartView, "container" | "deliveryId" | "deliveryLabel">;

const GUEST: Container = { container: "cart", deliveryId: null, deliveryLabel: null };

const EMPTY = {
  items: [],
  subtotal: 0,
  standardSubtotal: 0,
  memberSubtotal: 0,
  savingsIfMember: 0,
  itemCount: 0,
};

const ITEMS_INCLUDE = { items: { include: { product: true }, orderBy: { product: { name: "asc" as const } } } };

async function loadCartByToken(token: string | undefined) {
  if (!token) return null;
  return prisma.cart.findUnique({ where: { token }, include: ITEMS_INCLUDE });
}

function buildView(items: { quantity: number; product: import("@/generated/prisma/client").Product }[], who: Who, container: Container): CartView {
  const lines: CartLineView[] = items.map((i) => ({
    productId: i.product.id,
    slug: i.product.slug,
    name: i.product.name,
    unit: i.product.unit,
    orderUnit: i.product.orderUnit,
    minOrderQty: i.product.minOrderQty,
    stepQty: i.product.stepQty,
    imageEmoji: i.product.imageEmoji,
    cloudinaryPublicId: i.product.cloudinaryPublicId,
    memberPrice: i.product.memberPrice,
    standardPrice: i.product.standardPrice,
    quantity: i.quantity,
    soldOut: !isBuyable(i.product),
    limited: i.product.availability === "LIMITED",
  }));
  const standardSubtotal = lines.reduce((s, l) => s + l.standardPrice * l.quantity, 0);
  const memberSubtotal = lines.reduce((s, l) => s + l.memberPrice * l.quantity, 0);
  return {
    items: lines,
    subtotal: who.isSubscriber ? memberSubtotal : standardSubtotal,
    standardSubtotal,
    memberSubtotal,
    savingsIfMember: standardSubtotal - memberSubtotal,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    ...who,
    ...container,
  };
}

async function whoFor(user: Awaited<ReturnType<typeof getCurrentUser>>): Promise<Who> {
  const settings = await getSiteSettings();
  const zone = user ? await zoneForUser(user.id) : null;
  return {
    freeDeliveryThreshold: settings.delivery.freeThreshold,
    isSubscriber: Boolean(user?.subscriptionTierId),
    freeDelivery: hasFreeDelivery(user?.subscriptionTier?.slug),
    deliveryFee: zone?.deliveryFee ?? user?.deliveryZone?.deliveryFee ?? BASE_DELIVERY_FEE,
  };
}

async function deliveryView(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, basketId: string | null): Promise<CartView> {
  const who = await whoFor(user);
  const basket = basketId ? await prisma.basket.findFirst({ where: { id: basketId, userId: user.id }, include: ITEMS_INCLUDE }) : null;
  if (!basket) return { ...EMPTY, ...who, container: "delivery", deliveryId: null, deliveryLabel: null };
  return buildView(basket.items, who, { container: "delivery", deliveryId: basket.id, deliveryLabel: orderPhrase(basket) });
}

/** The view for Server Components and the header. Never creates anything or sets a cookie. */
export async function readCart(): Promise<CartView> {
  const user = await getCurrentUser();
  if (user) return deliveryView(user, (await readActiveDelivery(user.id))?.id ?? null);
  const cart = await loadCartByToken((await cookies()).get(CART_COOKIE)?.value);
  const who = await whoFor(null);
  if (!cart) return { ...EMPTY, ...who, ...GUEST };
  return buildView(cart.items, who, GUEST);
}

/**
 * Change one line in whatever the caller is filling and return the new view.
 * `mode: "add"` adds on top of the current quantity. Route handlers and server
 * actions only (it may create a cart cookie or a first delivery).
 */
export async function writeForCaller(productId: string, quantity: number, mode: "set" | "add" = "set"): Promise<CartView> {
  const user = await getCurrentUser();
  if (user) {
    const delivery = await getOrCreateActiveDelivery(user);
    await writeDeliveryLine(delivery.id, productId, quantity, mode);
    return deliveryView(user, delivery.id);
  }
  const cart = await getOrCreateCart();
  const existing = mode === "add" ? cart.items.find((i) => i.productId === productId)?.quantity ?? 0 : 0;
  await setCartItemQuantity(cart.id, productId, existing + quantity);
  return cartViewForCart(cart.id);
}

/**
 * Get the guest's cart, creating one (and setting the cookie) if needed.
 * Only call from Route Handlers or Server Actions. Server Components cannot set cookies.
 */
export async function getOrCreateCart() {
  const store = await cookies();
  const existing = await loadCartByToken(store.get(CART_COOKIE)?.value);
  if (existing) return existing;

  const newToken = randomUUID();
  const cart = await prisma.cart.create({ data: { token: newToken, userId: null }, include: ITEMS_INCLUDE });
  store.set(CART_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return cart;
}

export async function cartViewForCart(cartId: string): Promise<CartView> {
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: ITEMS_INCLUDE });
  const who = await whoFor(null);
  if (!cart) return { ...EMPTY, ...who, ...GUEST };
  return buildView(cart.items, who, GUEST);
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

/** A guest cart line, snapped to the product's pack size; zero removes it. */
export async function setCartItemQuantity(cartId: string, productId: string, quantity: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new OrderError("We couldn't find that item.");

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId, productId } });
    return { productId, name: product.name, quantity: 0 };
  }
  if (!isOffered(product)) throw new OrderError(`We don't sell ${product.name} any more.`);
  if (!isBuyable(product)) throw new OrderError(`${product.name} is sold out right now. We'll have more soon.`);

  const snapped = snapQuantity(quantity, product);
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    update: { quantity: snapped },
    create: { cartId, productId, quantity: snapped },
  });
  return { productId, name: product.name, quantity: snapped };
}
