"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getOrCreateActiveBasket } from "@/lib/basket";
import { toolAddItemToBasket, toolAddItemsToBasket, toolAddItemsToCart } from "@/lib/assistant-tools";
import { matchProductByName, normalizeTerm } from "@/lib/ingredient-match";
import {
  weekStartWithOffset,
  parseDays,
  parseElsewhereGot,
  getOrCreateWeeklyPlan,
  MEAL_PLAN_DAYS,
  type MealPlanDay,
  type MealPlanDayEntry,
  type MealSlotKey,
  type MealRef,
} from "@/lib/weekly-meal-plan";
import type { MealPlanDayStatus } from "@/generated/prisma/enums";
import type { Product, Recipe, OwnMeal } from "@/generated/prisma/client";

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

/** Bumps (or starts) the demand counter for an ingredient nothing in the catalog matched. */
async function logUnstockedIngredient(term: string) {
  const normalized = normalizeTerm(term);
  if (!normalized) return;
  await prisma.unstockedIngredientRequest.upsert({
    where: { term: normalized },
    update: { requestCount: { increment: 1 }, lastRequestedAt: new Date() },
    create: { term: normalized, requestCount: 1 },
  });
}

/** A slot's ingredients resolved to real product ids (we sell this) and free-text terms (get elsewhere). */
function resolveSlotIngredients(
  ref: MealRef,
  recipesById: Map<string, Recipe>,
  ownMealsById: Map<string, OwnMeal>,
): { productIds: string[]; elsewhereTerms: string[] } {
  if (ref.kind === "recipe") {
    const recipe = recipesById.get(ref.recipeId);
    return { productIds: recipe?.ingredientProductIds ?? [], elsewhereTerms: [] };
  }
  const meal = ownMealsById.get(ref.ownMealId);
  return { productIds: [], elsewhereTerms: meal?.ingredients ?? [] };
}

/**
 * Own-meal ingredients are free text, matched against the live catalog at
 * read time (never stored as a product id) so a later catalog change shows
 * up immediately. Returns the same shape as resolveSlotIngredients, with
 * every own-meal term re-split into a real product id or a "get elsewhere"
 * term.
 */
async function resolveWithLiveCatalog(
  refs: MealRef[],
  recipesById: Map<string, Recipe>,
  ownMealsById: Map<string, OwnMeal>,
  products: Product[],
): Promise<{ productIds: Set<string>; elsewhereTerms: Set<string> }> {
  const productIds = new Set<string>();
  const elsewhereTerms = new Set<string>();
  for (const ref of refs) {
    const { productIds: pids, elsewhereTerms: terms } = resolveSlotIngredients(ref, recipesById, ownMealsById);
    pids.forEach((id) => productIds.add(id));
    for (const term of terms) {
      const match = matchProductByName(term, products);
      if (match) productIds.add(match.id);
      else elsewhereTerms.add(normalizeTerm(term));
    }
  }
  return { productIds, elsewhereTerms };
}

function dayRefs(days: MealPlanDayEntry[], includeSkipped = false): MealRef[] {
  return days
    .filter((d) => includeSkipped || d.status !== "SKIPPED")
    .flatMap((d) => Object.values(d.slots))
    .filter((r): r is MealRef => r !== null);
}

async function loadRefLookups(refs: MealRef[]) {
  const recipeIds = refs.filter((r) => r.kind === "recipe").map((r) => r.recipeId);
  const ownMealIds = refs.filter((r) => r.kind === "own").map((r) => r.ownMealId);
  const [recipes, ownMeals, products] = await Promise.all([
    prisma.recipe.findMany({ where: { id: { in: recipeIds } } }),
    prisma.ownMeal.findMany({ where: { id: { in: ownMealIds } } }),
    prisma.product.findMany(),
  ]);
  return {
    recipesById: new Map(recipes.map((r) => [r.id, r])),
    ownMealsById: new Map(ownMeals.map((m) => [m.id, m])),
    products,
  };
}

/** Creates a customer's own meal. Ingredients that don't match the catalog log as demand right away. */
export async function addOwnMeal(name: string, ingredients: string[]): Promise<{ id: string }> {
  const user = await requireSubscriber();
  const cleanName = name.trim().slice(0, 120) || "My meal";
  const cleanIngredients = ingredients.map((i) => i.trim()).filter(Boolean).slice(0, 30);

  const products = await prisma.product.findMany();
  for (const term of cleanIngredients) {
    if (!matchProductByName(term, products)) await logUnstockedIngredient(term);
  }

  const meal = await prisma.ownMeal.create({
    data: { userId: user.id, name: cleanName, ingredients: cleanIngredients },
  });
  revalidatePath("/recipes");
  return { id: meal.id };
}

/** Places a recipe or an own meal into a specific day and slot the customer picked. */
export async function setMealSlot(
  weekOffset: number,
  day: MealPlanDay,
  slot: MealSlotKey,
  ref: MealRef | null,
): Promise<void> {
  const user = await requireSubscriber();
  const plan = await getOrCreateWeeklyPlan(user, weekStartWithOffset(weekOffset));
  const days = parseDays(plan.days);

  const updated: MealPlanDayEntry[] = days.map((d) =>
    d.day === day ? { ...d, slots: { ...d.slots, [slot]: ref } } : d,
  );

  await prisma.weeklyMealPlan.update({
    where: { id: plan.id },
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

/** Member-only "use this timetable every week" toggle (User.mealPlanRepeats). */
export async function setMealPlanRepeats(enabled: boolean) {
  const user = await requireSubscriber();
  await prisma.user.update({ where: { id: user.id }, data: { mealPlanRepeats: enabled } });
  revalidatePath("/recipes");
}

/** Ticks or unticks a "get elsewhere" item on this week's shopping list; persists across reloads. */
export async function toggleElsewhereGot(weekOffset: number, term: string) {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const got = parseElsewhereGot(row.elsewhereGot);
  const normalized = normalizeTerm(term);
  if (got.has(normalized)) got.delete(normalized);
  else got.add(normalized);

  await prisma.weeklyMealPlan.update({
    where: { id: row.id },
    data: { elsewhereGot: Array.from(got) as object as never },
  });
  revalidatePath("/recipes");
}

/**
 * Sends a day's missing ingredients to the customer's active basket, across
 * all three slots. Hands off to the Assistant's own add_item_to_basket tool
 * function rather than writing to BasketItem directly — Recipes still has
 * zero basket write path of its own, per the two-tier AI split addendum.
 */
export async function sendDayIngredientsToBasket(weekOffset: number, day: MealPlanDay) {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const entry = parseDays(row.days).find((d) => d.day === day);
  const refs = entry ? Object.values(entry.slots).filter((r): r is MealRef => r !== null) : [];
  if (refs.length === 0) return { added: 0 };

  const { recipesById, ownMealsById, products } = await loadRefLookups(refs);
  const { productIds } = await resolveWithLiveCatalog(refs, recipesById, ownMealsById, products);

  const basket = await getOrCreateActiveBasket(user.id, {
    isSubscriber: true,
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
  const existingIds = new Set(
    (await prisma.basketItem.findMany({ where: { basketId: basket.id } })).map((i) => i.productId),
  );
  const missing = Array.from(productIds).filter((id) => !existingIds.has(id));
  if (missing.length === 0) return { added: 0 };

  const missingProducts = products.filter((p) => missing.includes(p.id));
  let added = 0;
  for (const product of missingProducts) {
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

/** Everything the week's timetable needs: what we sell (with counts), and what to get elsewhere (with counts). */
export async function weekShoppingList(weekOffset: number) {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const days = parseDays(row.days);
  const refs = dayRefs(days);
  const { recipesById, ownMealsById, products } = await loadRefLookups(refs);

  const weSellCounts = new Map<string, number>();
  const elsewhereCounts = new Map<string, number>();
  for (const ref of refs) {
    const { productIds: pids, elsewhereTerms: terms } = resolveSlotIngredients(ref, recipesById, ownMealsById);
    pids.forEach((id) => weSellCounts.set(id, (weSellCounts.get(id) ?? 0) + 1));
    for (const term of terms) {
      const match = matchProductByName(term, products);
      if (match) weSellCounts.set(match.id, (weSellCounts.get(match.id) ?? 0) + 1);
      else {
        const normalized = normalizeTerm(term);
        elsewhereCounts.set(normalized, (elsewhereCounts.get(normalized) ?? 0) + 1);
      }
    }
  }

  const basket = await getOrCreateActiveBasket(user.id, {
    isSubscriber: true,
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
  const inBasket = new Set(
    (await prisma.basketItem.findMany({ where: { basketId: basket.id } })).map((i) => i.productId),
  );

  const weSellProducts = await prisma.product.findMany({ where: { id: { in: Array.from(weSellCounts.keys()) } } });
  const weSell = weSellProducts.map((p) => ({
    productId: p.id,
    name: p.name,
    imageEmoji: p.imageEmoji,
    cloudinaryPublicId: p.cloudinaryPublicId,
    standardPrice: p.standardPrice,
    memberPrice: p.memberPrice,
    mealCount: weSellCounts.get(p.id) ?? 0,
    haveIt: inBasket.has(p.id),
  }));

  const got = parseElsewhereGot(row.elsewhereGot);
  const elsewhere = Array.from(elsewhereCounts.entries()).map(([term, mealCount]) => ({
    term,
    mealCount,
    got: got.has(term),
  }));

  return { weSell, elsewhere };
}

/** Adds the picked "we sell these" items (only, not everything) to the destination the customer chose. */
export async function addShoppingListItems(
  productIds: string[],
  destination: "cart" | "basket",
): Promise<{ added: number }> {
  const user = await requireUser();
  if (productIds.length === 0) return { added: 0 };
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  if (destination === "cart") {
    const result = await toolAddItemsToCart(user, {
      items: products.map((p) => ({ product_id: p.id, quantity: p.minOrderQty })),
    });
    revalidatePath("/cart");
    revalidatePath("/recipes");
    return { added: result.ok ? result.data.added.length : 0 };
  }

  if (!user.subscriptionTierId) throw new Error("Sending ingredients to your basket is a subscriber feature.");
  const basket = await getOrCreateActiveBasket(user.id, {
    isSubscriber: true,
    deliveryDay: user.deliveryDay ?? "WEDNESDAY",
  });
  const result = await toolAddItemsToBasket(user, {
    basket_id: basket.id,
    items: products.map((p) => ({ product_id: p.id, quantity: p.minOrderQty })),
  });
  revalidatePath("/basket");
  revalidatePath("/recipes");
  return { added: result.ok ? result.data.added.length : 0 };
}

/** Week-level shortcut (Section 2b): everything the plan still needs, in one call. */
export async function sendWeekMissingToBasket(weekOffset: number): Promise<{ added: number }> {
  const { weSell } = await weekShoppingList(weekOffset);
  const missing = weSell.filter((l) => !l.haveIt).map((l) => l.productId);
  return addShoppingListItems(missing, "basket");
}

export async function sendWeekMissingToCart(weekOffset: number): Promise<{ added: number }> {
  const { weSell } = await weekShoppingList(weekOffset);
  const missing = weSell.filter((l) => !l.haveIt).map((l) => l.productId);
  return addShoppingListItems(missing, "cart");
}

/**
 * Library's "Add to plan": places a recipe on the next day/dinner slot that
 * isn't already marked cooked. The richer sheet flow (pick day + slot
 * explicitly) is `setMealSlot`; this stays as the one-tap shortcut from a
 * recipe card.
 */
export async function addRecipeToMealPlan(recipeId: string): Promise<void> {
  const user = await requireSubscriber();
  const plan = await getOrCreateWeeklyPlan(user);
  const days = parseDays(plan.days);

  const todayIndex = (new Date().getUTCDay() + 6) % 7; // 0 (Mon) .. 6 (Sun)
  const order = [...MEAL_PLAN_DAYS.slice(todayIndex), ...MEAL_PLAN_DAYS.slice(0, todayIndex)];
  const targetDay = order.find((d) => days.find((entry) => entry.day === d)?.status !== "COOKED") ?? order[0];

  const updated: MealPlanDayEntry[] = days.map((d) =>
    d.day === targetDay ? { ...d, slots: { ...d.slots, dinner: { kind: "recipe", recipeId } } } : d,
  );

  await prisma.weeklyMealPlan.update({
    where: { id: plan.id },
    data: { days: updated as object as never },
  });
  revalidatePath("/recipes");
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

/**
 * A recipe card's cart-bound counterpart: free accounts have no recurring
 * basket to compare against here (basket personalization is a subscriber
 * perk, per the Recipes-by-tier addendum), so this sends every ingredient to
 * the one-off cart rather than trying to diff against basket contents.
 */
export async function sendRecipeIngredientsToCart(recipeId: string): Promise<void> {
  const user = await requireUser();

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe || recipe.ingredientProductIds.length === 0) return;

  const products = await prisma.product.findMany({ where: { id: { in: recipe.ingredientProductIds } } });
  await toolAddItemsToCart(user, {
    items: products.map((p) => ({ product_id: p.id, quantity: p.minOrderQty })),
  });

  revalidatePath("/cart");
  revalidatePath("/recipes");
}
