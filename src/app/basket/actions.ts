"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentUser } from "@/lib/session";
import { getOrCreateStandingBasket } from "@/lib/basket";
import { getOrCreateCart, clearCart } from "@/lib/cart";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import type { DeliveryDay, ShoppingWindowDay } from "@/generated/prisma/enums";

function snapQty(quantity: number, minOrderQty: number, stepQty: number) {
  const above = Math.max(0, quantity - minOrderQty);
  return minOrderQty + Math.ceil(above / stepQty) * stepQty;
}

/**
 * "Subscribe & save" from a product page. Adds the item to the member's standing
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
  const basket = await getOrCreateStandingBasket(user.id, user.deliveryDay ?? "WEDNESDAY");

  await prisma.basket.update({
    where: { id: basket.id },
    data: { frequencyWeeks: frequencyWeeks === 2 ? 2 : 1 },
  });

  const qty = snapQty(quantity, product.minOrderQty, product.stepQty);
  const existing = await prisma.basketItem.findUnique({
    where: { basketId_productId: { basketId: basket.id, productId } },
  });
  await prisma.basketItem.upsert({
    where: { basketId_productId: { basketId: basket.id, productId } },
    update: { quantity: (existing?.quantity ?? 0) + qty },
    create: { basketId: basket.id, productId, quantity: qty },
  });

  redirect("/basket");
}

async function assertWindowOpen(userId: string) {
  // The window lock is a subscriber-only mechanic. A non-subscriber's saved
  // basket is theirs to edit at any time.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionTierId: true } });
  if (!user?.subscriptionTierId) return;

  const window = await getOrCreateCurrentWindow(userId);
  if (windowState(window).locked) {
    throw new Error("This week's shopping window is closed.");
  }
}

export async function setShoppingWindowDay(day: ShoppingWindowDay) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { shoppingWindowDay: day } });
  revalidatePath("/basket");
}

/** Move the standing basket into the cart and send the customer to checkout. */
export async function checkoutStandingBasket() {
  const user = await requireUser();
  const basket = await prisma.basket.findFirst({
    where: { userId: user.id, isStanding: true },
    include: { items: true },
  });
  if (!basket || basket.items.length === 0) redirect("/basket");

  const cart = await getOrCreateCart();
  await clearCart(cart.id);
  await prisma.cartItem.createMany({
    data: basket.items.map((i) => ({ cartId: cart.id, productId: i.productId, quantity: i.quantity })),
    skipDuplicates: true,
  });

  redirect("/checkout?source=basket");
}

export async function setBasketItemQuantity(productId: string, quantity: number) {
  const user = await requireUser();
  await assertWindowOpen(user.id);

  const basket = await getOrCreateStandingBasket(user.id, user.deliveryDay ?? "WEDNESDAY");
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

  if (quantity <= 0) {
    await prisma.basketItem.deleteMany({ where: { basketId: basket.id, productId } });
  } else {
    const above = Math.max(0, quantity - product.minOrderQty);
    const snapped = product.minOrderQty + Math.ceil(above / product.stepQty) * product.stepQty;
    await prisma.basketItem.upsert({
      where: { basketId_productId: { basketId: basket.id, productId } },
      update: { quantity: snapped },
      create: { basketId: basket.id, productId, quantity: snapped },
    });
  }

  revalidatePath("/basket");
}

export async function setBasketDeliveryDay(deliveryDay: DeliveryDay) {
  const user = await requireUser();
  const basket = await prisma.basket.findFirst({ where: { userId: user.id, isStanding: true } });
  if (basket) await prisma.basket.update({ where: { id: basket.id }, data: { deliveryDay } });
  await prisma.user.update({ where: { id: user.id }, data: { deliveryDay } });
  revalidatePath("/basket");
}

export async function setWindowSkipped(skipped: boolean) {
  const user = await requireUser();
  const window = await getOrCreateCurrentWindow(user.id);
  if (windowState(window).locked) throw new Error("The window is already closed.");
  await prisma.shoppingWindow.update({
    where: { id: window.id },
    data: { status: skipped ? "SKIPPED" : "OPEN" },
  });
  revalidatePath("/basket");
}

async function addProductAtMin(basketId: string, productId: string) {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const existing = await prisma.basketItem.findUnique({
    where: { basketId_productId: { basketId, productId } },
  });
  if (existing) return;
  await prisma.basketItem.create({
    data: { basketId, productId, quantity: product.minOrderQty },
  });
}

/** Tap a swap chip on a flagged item: remove one product, add another. */
export async function swapBasketItem(fromProductId: string, toProductId: string) {
  const user = await requireUser();
  await assertWindowOpen(user.id);
  const basket = await getOrCreateStandingBasket(user.id, user.deliveryDay ?? "WEDNESDAY");

  await prisma.basketItem.deleteMany({ where: { basketId: basket.id, productId: fromProductId } });
  await addProductAtMin(basket.id, toProductId);
  revalidatePath("/basket");
}

/** Add the ingredients a suggested recipe needs that are not already in the basket. */
export async function addRecipeIngredients(recipeSlug: string) {
  const user = await requireUser();
  await assertWindowOpen(user.id);
  const basket = await getOrCreateStandingBasket(user.id, user.deliveryDay ?? "WEDNESDAY");

  const recipe = await prisma.recipe.findUnique({ where: { slug: recipeSlug } });
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
export async function applyStarterPicks(picks: { productId: string; quantity: number }[]) {
  const user = await requireUser();
  await assertWindowOpen(user.id);
  const basket = await getOrCreateStandingBasket(user.id, user.deliveryDay ?? "WEDNESDAY");

  await prisma.basketItem.createMany({
    data: picks.map((p) => ({ basketId: basket.id, productId: p.productId, quantity: p.quantity })),
    skipDuplicates: true,
  });
  revalidatePath("/basket");
}

/** The onboarding-style explainer shows once on a member's first basket visit, then never again. */
export async function markBasketIntroSeen() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { basketIntroSeen: true } });
}

/** Restore the items from the member's most recent finalized order into this window. */
export async function restoreLastWeek() {
  const user = await requireUser();
  await assertWindowOpen(user.id);
  const basket = await getOrCreateStandingBasket(user.id, user.deliveryDay ?? "WEDNESDAY");

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
