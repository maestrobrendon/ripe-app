import "server-only";
import { isOffered, isBuyable, snapQuantity } from "@/lib/product";
import { BASE_DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, hasFreeDelivery } from "@/lib/pricing";
import { getSiteSettings } from "@/lib/site-settings";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

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
  /** Cart value for free delivery (a site setting). */
  freeDeliveryThreshold: number;
};

const EMPTY: CartView = {
  items: [],
  subtotal: 0,
  standardSubtotal: 0,
  memberSubtotal: 0,
  savingsIfMember: 0,
  itemCount: 0,
  isSubscriber: false,
  freeDelivery: false,
  deliveryFee: BASE_DELIVERY_FEE,
  freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
};

async function loadCartByToken(token: string | undefined) {
  if (!token) return null;
  return prisma.cart.findUnique({
    where: { token },
    include: { items: { include: { product: true }, orderBy: { product: { name: "asc" } } } },
  });
}

function buildView(
  items: { quantity: number; product: import("@/generated/prisma/client").Product }[],
  who: Who,
): CartView {
  const { isSubscriber } = who;
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
  }));

  const standardSubtotal = lines.reduce((s, l) => s + l.standardPrice * l.quantity, 0);
  const memberSubtotal = lines.reduce((s, l) => s + l.memberPrice * l.quantity, 0);
  const subtotal = isSubscriber ? memberSubtotal : standardSubtotal;

  return {
    items: lines,
    subtotal,
    standardSubtotal,
    memberSubtotal,
    savingsIfMember: standardSubtotal - memberSubtotal,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    ...who,
  };
}

/** What the signed-in customer pays: member prices, free delivery, their area's fee. */
type Who = Pick<CartView, "isSubscriber" | "freeDelivery" | "deliveryFee" | "freeDeliveryThreshold">;

async function whoFor(user: Awaited<ReturnType<typeof getCurrentUser>>): Promise<Who> {
  const settings = await getSiteSettings();
  return {
    freeDeliveryThreshold: settings.delivery.freeThreshold,
    isSubscriber: Boolean(user?.subscriptionTierId),
    freeDelivery: hasFreeDelivery(user?.subscriptionTier?.slug),
    deliveryFee: user?.deliveryZone?.deliveryFee ?? BASE_DELIVERY_FEE,
  };
}

/** Read-only cart view for Server Components. Never creates a cart or sets a cookie. */
export async function readCart(): Promise<CartView> {
  const store = await cookies();
  const cart = await loadCartByToken(store.get(CART_COOKIE)?.value);
  const who = await whoFor(await getCurrentUser());
  if (!cart) return { ...EMPTY, ...who };
  return buildView(cart.items, who);
}

/**
 * Get the caller's cart, creating one (and setting the cookie) if needed.
 * Only call from Route Handlers or Server Actions. Server Components cannot set cookies.
 */
export async function getOrCreateCart() {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  const existing = await loadCartByToken(token);
  if (existing) return existing;

  const user = await getCurrentUser();
  const newToken = randomUUID();
  const cart = await prisma.cart.create({
    data: { token: newToken, userId: user?.id ?? null },
    include: { items: { include: { product: true }, orderBy: { product: { name: "asc" } } } },
  });
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
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true }, orderBy: { product: { name: "asc" } } } },
  });
  const who = await whoFor(await getCurrentUser());
  if (!cart) return { ...EMPTY, ...who };
  return buildView(cart.items, who);
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

/**
 * The one place cart item quantity is written, so the cart API route,
 * Recipes/Planner buttons, and the Assistant's cart tools all go through the
 * same snapping and delete-at-zero rules (Basket vs. Cart addendum, Section 5:
 * a shared service, not a path that only exists because the model asked).
 */
export async function setCartItemQuantity(cartId: string, productId: string, quantity: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("That product doesn't exist.");

  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId, productId } });
    return { productId, name: product.name, quantity: 0 };
  }
  if (!isOffered(product)) throw new Error("We don't sell that any more.");
  if (!isBuyable(product)) throw new Error(`${product.name} is out of stock right now.`);

  const snapped = snapQuantity(quantity, product);
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    update: { quantity: snapped },
    create: { cartId, productId, quantity: snapped },
  });
  return { productId, name: product.name, quantity: snapped };
}
