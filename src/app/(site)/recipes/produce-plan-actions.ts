"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getOrCreateActiveBasket } from "@/lib/basket";
import { toolAddItemsToBasket } from "@/lib/assistant-tools";
import type { PrepGroup } from "@/lib/produce-variety";

type PlanItemInput = { productId: string; quantity: number; prep: PrepGroup };

/**
 * Free accounts keep only their latest produce plan; subscribers keep
 * history (Section 2c). That's a difference in what gets read back later,
 * not the schema, so the write here is the same for both tiers — a free
 * account's older rows are simply pruned so "latest" stays true by
 * construction rather than by a query that has to remember to filter.
 */
export async function saveProducePlan(input: {
  weekStart: string;
  householdSize: number;
  goal?: string;
  theme?: string;
  items: PlanItemInput[];
}) {
  const user = await requireUser();
  const weekStart = new Date(input.weekStart);

  if (!user.subscriptionTierId) {
    await prisma.producePlan.deleteMany({ where: { userId: user.id } });
  }

  await prisma.producePlan.create({
    data: {
      userId: user.id,
      weekStart,
      householdSize: input.householdSize,
      goal: input.goal ?? null,
      theme: input.theme ?? null,
      items: input.items as object as never,
    },
  });
  revalidatePath("/recipes");
}

/** "Make this my basket" (Section 2c): sends every line straight to the customer's recurring basket, not the one-off cart. */
export async function makeThisMyBasket(items: { productId: string; quantity: number }[]) {
  const user = await requireUser();
  const basket = await getOrCreateActiveBasket(user.id, {
    isSubscriber: Boolean(user.subscriptionTierId),
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
  const result = await toolAddItemsToBasket(user, {
    basket_id: basket.id,
    items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
  });
  revalidatePath("/basket");
  revalidatePath("/recipes");
  return { added: result.ok ? result.data.added.length : 0, basketId: basket.id };
}
