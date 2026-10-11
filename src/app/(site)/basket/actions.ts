"use server";

import { BUYABLE, isOffered, isBuyable, snapQuantity } from "@/lib/product";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentUser } from "@/lib/session";
import {
  createUserBasket,
  getOrCreateActiveBasket,
  getOwnedBasket,
  BasketCapReachedError,
} from "@/lib/basket";
import { getOrCreateCart, clearCart } from "@/lib/cart";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import type { DeliveryDay, ShoppingWindowDay } from "@/generated/prisma/enums";
import type { CurrentUser } from "@/lib/session";

/** Every mutating action takes an optional basket id (explicit when switching between several) and falls back to the member's active basket. */
async function resolveBasket(user: CurrentUser, basketId: string | undefined) {
  if (basketId) {
    const owned = await getOwnedBasket(user.id, basketId);
    if (owned) return owned;
  }
  return getOrCreateActiveBasket(user.id, {
    isSubscriber: Boolean(user.subscriptionTierId),
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
}

/**
 * "Subscribe & save" from a product page. Adds the item to the member's active
 * basket and records the cadence, then routes non-members to subscribe first.
 */
export async function addToStandingBasket(
  productId: string,
  quantity: number,
  frequencyWeeks: number,
) {
  const user = await getCurrentUser();
  // "Subscribe & save" is a subscription funnel: it needs an account and a plan.
  if (!user) redirect("/start");
  if (!user.subscriptionTierId) redirect("/subscribe");

  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  if (!isOffered(product)) throw new Error("We don't sell that any more.");
  if (!isBuyable(product)) throw new Error(`${product.name} is out of stock right now.`);
  const basket = await resolveBasket(user, undefined);

  await prisma.basket.update({
    where: { id: basket.id },
    data: { frequencyWeeks: frequencyWeeks === 2 ? 2 : 1 },
  });

  const qty = snapQuantity(quantity, product);
  const existing = await prisma.basketItem.findUnique({
    where: { basketId_productId: { basketId: basket.id, productId } },
  });
  await prisma.basketItem.upsert({
    where: { basketId_productId: { basketId: basket.id, productId } },
    update: { quantity: snapQuantity((existing?.quantity ?? 0) + qty, product) },
    create: { basketId: basket.id, productId, quantity: qty },
  });

  redirect("/basket");
}

// The window lock is a subscriber-basket mechanic: a free-trial basket never
// auto-recurs (Section 1 of the addendum), so it never locks either.
async function assertWindowOpen(basket: { id: string; isFreeTrial: boolean }) {
  if (basket.isFreeTrial) return;
  const window = await getOrCreateCurrentWindow(basket.id);
  if (windowState(window).locked) {
    throw new Error("This week's shopping window is closed.");
  }
}

export async function setShoppingWindowDay(basketId: string | undefined, day: ShoppingWindowDay) {
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  await prisma.basket.update({ where: { id: basket.id }, data: { shoppingWindowDay: day } });
  revalidatePath("/basket");
}

/** Move a basket's contents into the cart and send the customer to checkout. */
export async function checkoutStandingBasket(basketId?: string) {
  const user = await requireUser();
  const basket = await prisma.basket.findFirst({
    where: basketId ? { id: basketId, userId: user.id } : { userId: user.id },
    orderBy: basketId ? undefined : { updatedAt: "desc" },
    include: { items: true },
  });
  if (!basket || basket.items.length === 0) redirect("/basket");

  const cart = await getOrCreateCart();
  await clearCart(cart.id);
  await prisma.cartItem.createMany({
    data: basket.items.map((i) => ({ cartId: cart.id, productId: i.productId, quantity: i.quantity })),
    skipDuplicates: true,
  });

  redirect(`/checkout?source=basket&basketId=${basket.id}`);
}

/**
 * "Buy these once": copies a delivered trial basket's items into the cart
 * without touching the basket itself or going straight to checkout, so the
 * customer lands on the cart screen able to add or remove things first.
 */
export async function copyBasketToCart(basketId: string) {
  const user = await requireUser();
  const basket = await prisma.basket.findFirst({
    where: { id: basketId, userId: user.id },
    include: { items: true },
  });
  if (!basket || basket.items.length === 0) redirect("/basket");

  const cart = await getOrCreateCart();
  for (const item of basket.items) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
    });
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
      update: { quantity: (existing?.quantity ?? 0) + item.quantity },
      create: { cartId: cart.id, productId: item.productId, quantity: item.quantity },
    });
  }

  redirect("/cart");
}

export async function setBasketItemQuantity(basketId: string | undefined, productId: string, quantity: number) {
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  await assertWindowOpen(basket);
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

  if (quantity <= 0) {
    await prisma.basketItem.deleteMany({ where: { basketId: basket.id, productId } });
  } else {
    if (!isOffered(product)) throw new Error("We don't sell that any more.");
    if (!isBuyable(product)) throw new Error(`${product.name} is out of stock right now.`);
    const snapped = snapQuantity(quantity, product);
    await prisma.basketItem.upsert({
      where: { basketId_productId: { basketId: basket.id, productId } },
      update: { quantity: snapped },
      create: { basketId: basket.id, productId, quantity: snapped },
    });
  }

  revalidatePath("/basket");
}

export async function setBasketDeliveryDay(basketId: string | undefined, deliveryDay: DeliveryDay) {
  if (!(["MONDAY", "WEDNESDAY", "FRIDAY"] as const).includes(deliveryDay)) throw new Error("Pick a delivery day.");
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  await prisma.basket.update({ where: { id: basket.id }, data: { deliveryDay } });
  revalidatePath("/basket");
}

export async function setWindowSkipped(basketId: string | undefined, skipped: boolean) {
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  const window = await getOrCreateCurrentWindow(basket.id);
  if (windowState(window).locked) throw new Error("The window is already closed.");
  await prisma.shoppingWindow.update({
    where: { id: window.id },
    data: { status: skipped ? "SKIPPED" : "OPEN" },
  });
  revalidatePath("/basket");
}

async function addProductAtMin(basketId: string, productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  if (!isBuyable(product)) return;
  const existing = await prisma.basketItem.findUnique({
    where: { basketId_productId: { basketId, productId } },
  });
  if (existing) return;
  await prisma.basketItem.create({
    data: { basketId, productId, quantity: product.minOrderQty },
  });
}

/** Tap a swap chip on a flagged item: remove one product, add another. */
export async function swapBasketItem(basketId: string | undefined, fromProductId: string, toProductId: string) {
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  await assertWindowOpen(basket);

  await prisma.basketItem.deleteMany({ where: { basketId: basket.id, productId: fromProductId } });
  await addProductAtMin(basket.id, toProductId);
  revalidatePath("/basket");
}

/** Add the ingredients a suggested recipe needs that are not already in the basket. */
export async function addRecipeIngredients(basketId: string | undefined, recipeSlug: string) {
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  await assertWindowOpen(basket);

  const recipe = await prisma.recipe.findFirst({ where: { slug: recipeSlug, status: "PUBLISHED" } });
  if (!recipe) return;

  const existing = new Set(
    (await prisma.basketItem.findMany({ where: { basketId: basket.id } })).map((i) => i.productId),
  );
  for (const productId of recipe.ingredientProductIds) {
    if (!existing.has(productId)) await addProductAtMin(basket.id, productId);
  }
  revalidatePath("/basket");
}

/** Add every pick from an Ideas starter set in one go, for the empty-basket case. */
export async function applyStarterPicks(
  basketId: string | undefined,
  picks: { productId: string; quantity: number }[],
) {
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  await assertWindowOpen(basket);

  // The picks come from the browser: keep only products we sell, at quantities they allow.
  const wanted = picks.slice(0, 60);
  const products = await prisma.product.findMany({ where: { id: { in: wanted.map((p) => p.productId) }, ...BUYABLE } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const data = wanted.flatMap((p) => {
    const product = byId.get(p.productId);
    const quantity = product ? snapQuantity(p.quantity, product) : 0;
    return product && quantity > 0 ? [{ basketId: basket.id, productId: product.id, quantity }] : [];
  });
  await prisma.basketItem.createMany({ data, skipDuplicates: true });
  revalidatePath("/basket");
}

/** The onboarding-style explainer shows once on a member's first basket visit, then never again. */
export async function markBasketIntroSeen() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { basketIntroSeen: true } });
}

/** Restore the items from the member's most recent finalized order into this window. */
export async function restoreLastWeek(basketId?: string) {
  const user = await requireUser();
  const basket = await resolveBasket(user, basketId);
  await assertWindowOpen(basket);

  const lastOrder = await prisma.order.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (!lastOrder || lastOrder.items.length === 0) return;

  await prisma.basketItem.deleteMany({ where: { basketId: basket.id } });
  await prisma.basketItem.createMany({
    data: lastOrder.items.map((i) => ({
      basketId: basket.id,
      productId: i.productId,
      quantity: i.quantity,
    })),
    skipDuplicates: true,
  });
  revalidatePath("/basket");
}

/**
 * Starts a new basket, up to the plan's limit (lib/basket.ts). At the cap,
 * pricing explains why: a used free basket, or Member's three.
 */
export async function createBasket() {
  const user = await requireUser();
  try {
    const basket = await createUserBasket(user.id, {
      isSubscriber: Boolean(user.subscriptionTierId),
      tierSlug: user.subscriptionTier?.slug,
      deliveryDay: user.deliveryDay ?? "WEDNESDAY",
    });
    redirect(`/basket?b=${basket.id}`);
  } catch (err) {
    if (err instanceof BasketCapReachedError) {
      redirect(err.reason === "trial" ? "/subscribe?reason=free-basket-used" : "/subscribe?reason=basket-limit");
    }
    throw err;
  }
}
