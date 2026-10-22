"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/session";
import { getMenu } from "@/lib/menu";
import { addLinesToDelivery, getOrCreateActiveDelivery, readActiveDelivery } from "@/lib/order-container";
import { orderPhrase } from "@/lib/delivery-labels";
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
import { OFFERED } from "@/lib/product";

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
    prisma.product.findMany({ where: OFFERED }),
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

  const products = await prisma.product.findMany({ where: OFFERED });
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
 * Adds whichever of these products the customer's order doesn't already
 * hold, at each product's smallest pack. Everyone has one order (this week's
 * delivery), so recipes, the meal plan and the shopping list all fill it.
 */
async function addMissingToOrder(user: CurrentUser, productIds: string[]): Promise<{ added: number; label: string }> {
  const delivery = await getOrCreateActiveDelivery(user);
  const existing = new Set((await prisma.basketItem.findMany({ where: { basketId: delivery.id }, select: { productId: true } })).map((i) => i.productId));
  const missing = [...new Set(productIds)].filter((id) => !existing.has(id));
  const products = missing.length ? await prisma.product.findMany({ where: { id: { in: missing } }, select: { id: true, minOrderQty: true } }) : [];
  const added = await addLinesToDelivery(delivery.id, products.map((p) => ({ productId: p.id, quantity: p.minOrderQty })));
  revalidatePath("/basket");
  revalidatePath("/recipes");
  return { added, label: orderPhrase(delivery) };
}

/** Sends a day's missing ingredients, across its three meals, to the order. */
export async function sendDayIngredientsToBasket(weekOffset: number, day: MealPlanDay) {
  const user = await requireSubscriber();
  const row = await loadPlanRow(user.id, weekOffset);
  const entry = parseDays(row.days).find((d) => d.day === day);
  const refs = entry ? Object.values(entry.slots).filter((r): r is MealRef => r !== null) : [];
  if (refs.length === 0) return { added: 0 };

  const { recipesById, ownMealsById, products } = await loadRefLookups(refs);
  const { productIds } = await resolveWithLiveCatalog(refs, recipesById, ownMealsById, products);
  return addMissingToOrder(user, Array.from(productIds));
}

/** Everything the week's meal plan needs: what we sell (with counts), and what to get elsewhere (with counts). */
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

  const delivery = await readActiveDelivery(user.id);
  const inOrder = new Set(delivery ? (await prisma.basketItem.findMany({ where: { basketId: delivery.id } })).map((i) => i.productId) : []);

  const weSellProducts = await prisma.product.findMany({ where: { id: { in: Array.from(weSellCounts.keys()) } } });
  const weSell = weSellProducts.map((p) => ({
    productId: p.id,
    name: p.name,
    imageEmoji: p.imageEmoji,
    cloudinaryPublicId: p.cloudinaryPublicId,
    standardPrice: p.standardPrice,
    memberPrice: p.memberPrice,
    mealCount: weSellCounts.get(p.id) ?? 0,
    haveIt: inOrder.has(p.id),
  }));

  const got = parseElsewhereGot(row.elsewhereGot);
  const elsewhere = Array.from(elsewhereCounts.entries()).map(([term, mealCount]) => ({ term, mealCount, got: got.has(term) }));
  return { weSell, elsewhere };
}

/** Adds the ticked "we can bring these" items to the order. */
export async function addShoppingListItems(productIds: string[]): Promise<{ added: number; label: string }> {
  const user = await requireUser();
  if (productIds.length === 0) return { added: 0, label: "your order" };
  return addMissingToOrder(user, productIds);
}

/** Everything the meal plan still needs, in one tap. */
export async function sendWeekMissingToOrder(weekOffset: number): Promise<{ added: number; label: string }> {
  const { weSell } = await weekShoppingList(weekOffset);
  return addShoppingListItems(weSell.filter((l) => !l.haveIt).map((l) => l.productId));
}

/**
 * A recipe card's "Add to plan": the next day's dinner from today that isn't
 * already cooked. The richer sheet flow (pick a day and meal) is `setMealSlot`.
 */
export async function addRecipeToMealPlan(recipeId: string): Promise<void> {
  const user = await requireSubscriber();
  const plan = await getOrCreateWeeklyPlan(user);
  const days = parseDays(plan.days);

  const todayIndex = (new Date().getUTCDay() + 6) % 7; // 0 (Mon) .. 6 (Sun)
  const order = [...MEAL_PLAN_DAYS.slice(todayIndex), ...MEAL_PLAN_DAYS.slice(0, todayIndex)];
  const targetDay = order.find((d) => days.find((entry) => entry.day === d)?.status !== "COOKED") ?? order[0];

  const updated: MealPlanDayEntry[] = days.map((d) => (d.day === targetDay ? { ...d, slots: { ...d.slots, dinner: { kind: "recipe", recipeId } } } : d));
  await prisma.weeklyMealPlan.update({ where: { id: plan.id }, data: { days: updated as object as never } });
  revalidatePath("/recipes");
}

/** A recipe card's "Add what's missing", bound as a plain form action (so it resolves to void). */
export async function sendRecipeIngredientsToOrder(recipeId: string): Promise<void> {
  const user = await requireUser();
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return;
  await addMissingToOrder(user, recipe.ingredientProductIds);
}

/**
 * The recipe page's button, for a menu recipe (by its catalogue slugs) or a
 * library one: whatever the order doesn't already have.
 */
export async function sendRecipeBySlug(slug: string): Promise<{ added: number; label: string }> {
  const user = await requireUser();
  const menu = (await getMenu()).find((r) => r.slug === slug);
  const productIds = menu
    ? (await prisma.product.findMany({ where: { slug: { in: menu.basket } }, select: { id: true } })).map((p) => p.id)
    : ((await prisma.recipe.findFirst({ where: { slug, status: "PUBLISHED" }, select: { ingredientProductIds: true } }))?.ingredientProductIds ?? []);
  return addMissingToOrder(user, productIds);
}
