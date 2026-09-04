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
};

const EMPTY: CartView = {
  items: [],
  subtotal: 0,
  standardSubtotal: 0,
  memberSubtotal: 0,
  savingsIfMember: 0,
  itemCount: 0,
  isSubscriber: false,
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
  isSubscriber: boolean,
): CartView {
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
    isSubscriber,
  };
}

/** Read-only cart view for Server Components. Never creates a cart or sets a cookie. */
export async function readCart(): Promise<CartView> {
  const store = await cookies();
  const cart = await loadCartByToken(store.get(CART_COOKIE)?.value);
  const user = await getCurrentUser();
  const isSubscriber = Boolean(user?.subscriptionTierId);
  if (!cart) return { ...EMPTY, isSubscriber };
  return buildView(cart.items, isSubscriber);
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
  const user = await getCurrentUser();
  const isSubscriber = Boolean(user?.subscriptionTierId);
  if (!cart) return { ...EMPTY, isSubscriber };
  return buildView(cart.items, isSubscriber);
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}
