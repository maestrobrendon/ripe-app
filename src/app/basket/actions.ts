"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentUser } from "@/lib/session";
import { getOrCreateStandingBasket } from "@/lib/basket";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import type { DeliveryDay } from "@/generated/prisma/enums";

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
  if (!user) redirect(`/signup?next=${encodeURIComponent("/subscribe")}`);
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
  const window = await getOrCreateCurrentWindow(userId);
  if (windowState(window).locked) {
    throw new Error("This week's shopping window is closed.");
  }
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
