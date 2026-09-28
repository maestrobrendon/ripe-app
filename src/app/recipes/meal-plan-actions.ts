"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getOrCreateActiveBasket } from "@/lib/basket";
import { toolAddItemToBasket, toolAddItemsToBasket, toolAddItemsToCart } from "@/lib/assistant-tools";
import {
  weekStartWithOffset,
  parseDays,
  getOrCreateWeeklyPlan,
  MEAL_PLAN_DAYS,
  type MealPlanDay,
  type MealPlanDayEntry,
} from "@/lib/weekly-meal-plan";
import type { MealPlanDayStatus } from "@/generated/prisma/enums";

/** Every meal-plan action here is subscriber-only: the builder is fully
 * locked for a free account (Recipes-by-tier addendum, Section 1), so there
 * is nothing for these to act on without a subscription. */
async function requireSubscriber() {
  const user = await requireUser();
  if (!user.subscriptionTierId) {
    throw new Error("The weekly meal plan is a subscriber feature.");
  }
  return user;
}

async function loadPlanRow(userId: string, weekOffset: number) {
  const weekStartDate = weekStartWithOffset(weekOffset);
  const row = await prisma.weeklyMealPlan.findUnique({
    where: { userId_weekStartDate: { userId, weekStartDate } },
  });
  if (!row) throw new Error("No meal plan for that week yet.");
  return row;
}

async function candidatePool(primaryGoal: string | null | undefined) {
  const goalMatched = primaryGoal
    ? await prisma.recipe.findMany({ where: { goalTags: { has: primaryGoal } } })
    : [];
  return goalMatched.length > 0 ? goalMatched : prisma.recipe.findMany({ take: 20 });
}

/**
 * Library's "Add to plan" (Section 2a): places a recipe on the next day that
 * isn't already marked cooked, rather than asking for a day up front — there
 * is no day-picker UI yet, and Swap/Skip on the Meal Planner tab already
 * cover rearranging it afterward.
 */
export async function addRecipeToMealPlan(recipeId: string): Promise<void> {
  const user = await requireSubscriber();
  const plan = await getOrCreateWeeklyPlan(user);
  const days = parseDays(plan.days);

  const todayIndex = (new Date().getUTCDay() + 6) % 7; // 0 (Mon) .. 6 (Sun)
  const order = [...MEAL_PLAN_DAYS.slice(todayIndex), ...MEAL_PLAN_DAYS.slice(0, todayIndex)];
  const targetDay = order.find((d) => days.find((entry) => entry.day === d)?.status !== "COOKED") ?? order[0];

  const updated: MealPlanDayEntry[] = days.map((d) =>
    d.day === targetDay ? { ...d, recipeId, suggestion: null, status: "PLANNED" } : d,
  );

  await prisma.weeklyMealPlan.update({
    where: { id: plan.id },
    data: { days: updated as object as never },
  });
  revalidatePath("/recipes");
}

export async function swapMealPlanDay(weekOffset: number, day: MealPlanDay) {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const days = parseDays(row.days);

  const pool = await candidatePool(user.preferences?.primaryGoal);
  const current = days.find((d) => d.day === day);
  const alternatives = pool.filter((r) => r.id !== current?.recipeId);
  const next = alternatives.length > 0 ? alternatives[Math.floor(Math.random() * alternatives.length)] : pool[0];

  const updated: MealPlanDayEntry[] = days.map((d) =>
    d.day === day ? { ...d, recipeId: next?.id ?? d.recipeId, suggestion: null } : d,
  );

  await prisma.weeklyMealPlan.update({
    where: { id: row.id },
    data: { days: updated as object as never },
  });
  revalidatePath("/recipes");
}

export async function setMealPlanDayStatus(weekOffset: number, day: MealPlanDay, status: MealPlanDayStatus) {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const days = parseDays(row.days);

  const updated: MealPlanDayEntry[] = days.map((d) => (d.day === day ? { ...d, status } : d));

  await prisma.weeklyMealPlan.update({
    where: { id: row.id },
    data: { days: updated as object as never },
  });
  revalidatePath("/recipes");
}

/**
 * Sends a day's missing ingredients to the customer's active basket. This
 * hands off to the Assistant's own add_item_to_basket tool function rather
 * than writing to BasketItem directly — Recipes still has zero basket write
 * path of its own, per the two-tier AI split addendum.
 */
export async function sendDayIngredientsToBasket(weekOffset: number, day: MealPlanDay) {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const entry = parseDays(row.days).find((d) => d.day === day);
  if (!entry?.recipeId) return { added: 0 };

  const recipe = await prisma.recipe.findUnique({ where: { id: entry.recipeId } });
  if (!recipe) return { added: 0 };

  const basket = await getOrCreateActiveBasket(user.id, {
    isSubscriber: true,
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
  const existingIds = new Set(
    (await prisma.basketItem.findMany({ where: { basketId: basket.id } })).map((i) => i.productId),
  );
  const missing = recipe.ingredientProductIds.filter((id) => !existingIds.has(id));
  if (missing.length === 0) return { added: 0 };

  const products = await prisma.product.findMany({ where: { id: { in: missing } } });
  let added = 0;
  for (const product of products) {
    const result = await toolAddItemToBasket(user, {
      basket_id: basket.id,
      product_id: product.id,
      quantity: product.minOrderQty,
    });
    if (result.ok) added += 1;
  }

  revalidatePath("/basket");
  revalidatePath("/recipes");
  return { added };
}

async function weekMissingProductIds(userId: string, days: MealPlanDayEntry[]) {
  const recipeIds = days
    .filter((d) => d.status !== "SKIPPED" && d.recipeId)
    .map((d) => d.recipeId as string);
  const recipes = await prisma.recipe.findMany({ where: { id: { in: recipeIds } } });
  const needed = new Set(recipes.flatMap((r) => r.ingredientProductIds));

  const basket = await getOrCreateActiveBasket(userId, { isSubscriber: true, deliveryDay: "WEDNESDAY" });
  const inBasket = new Set(
    (await prisma.basketItem.findMany({ where: { basketId: basket.id } })).map((i) => i.productId),
  );
  return { basketId: basket.id, missing: Array.from(needed).filter((id) => !inBasket.has(id)) };
}

/** Week-level shopping list actions (Section 2b): everything the plan still needs, in one call. */
export async function sendWeekMissingToBasket(weekOffset: number): Promise<{ added: number }> {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const days = parseDays(row.days);
  const { basketId, missing } = await weekMissingProductIds(user.id, days);
  if (missing.length === 0) return { added: 0 };

  const products = await prisma.product.findMany({ where: { id: { in: missing } } });
  const result = await toolAddItemsToBasket(user, {
    basket_id: basketId,
    items: products.map((p) => ({ product_id: p.id, quantity: p.minOrderQty })),
  });
  revalidatePath("/basket");
  revalidatePath("/recipes");
  return { added: result.ok ? result.data.added.length : 0 };
}

export async function sendWeekMissingToCart(weekOffset: number): Promise<{ added: number }> {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const days = parseDays(row.days);
  const { missing } = await weekMissingProductIds(user.id, days);
  if (missing.length === 0) return { added: 0 };

  const products = await prisma.product.findMany({ where: { id: { in: missing } } });
  const result = await toolAddItemsToCart(user, {
    items: products.map((p) => ({ product_id: p.id, quantity: p.minOrderQty })),
  });
  revalidatePath("/cart");
  revalidatePath("/recipes");
  return { added: result.ok ? result.data.added.length : 0 };
}

/**
 * For a recipe card outside the weekly plan (Section 2's "individual recipe
 * cards"). Returns void, not a result object: it's bound as a plain <form
 * action>, which Next.js requires to resolve to void.
 */
export async function sendRecipeIngredientsToBasket(recipeId: string): Promise<void> {
  const user = await requireUser();
  if (!user.subscriptionTierId) {
    throw new Error("Sending ingredients to your basket is a subscriber feature.");
  }

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return;

  const basket = await getOrCreateActiveBasket(user.id, {
    isSubscriber: true,
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
  const existingIds = new Set(
    (await prisma.basketItem.findMany({ where: { basketId: basket.id } })).map((i) => i.productId),
  );
  const missing = recipe.ingredientProductIds.filter((id) => !existingIds.has(id));
  if (missing.length === 0) return;

  const products = await prisma.product.findMany({ where: { id: { in: missing } } });
  for (const product of products) {
    await toolAddItemToBasket(user, {
      basket_id: basket.id,
      product_id: product.id,
      quantity: product.minOrderQty,
    });
  }

  revalidatePath("/basket");
  revalidatePath("/recipes");
}
