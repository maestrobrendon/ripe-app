"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getActiveBasketReadOnly, getBasketView } from "@/lib/basket";
import type { RecipeSheetData } from "./recipe-sheet";

/**
 * On-demand recipe detail for a sheet opened from somewhere that only has a
 * recipe id in hand (the Meal Plan tab's "See the recipe"), rather than
 * shipping every recipe's full ingredient list to the client up front.
 */
export async function getRecipeDetail(recipeId: string): Promise<RecipeSheetData | null> {
  const [user, recipe] = await Promise.all([
    getCurrentUser(),
    prisma.recipe.findUnique({ where: { id: recipeId } }),
  ]);
  if (!recipe) return null;

  const products = await prisma.product.findMany({ where: { id: { in: recipe.ingredientProductIds } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  let haveIds = new Set<string>();
  const isSubscriber = Boolean(user?.subscriptionTierId);
  if (isSubscriber && user) {
    const activeBasket = await getActiveBasketReadOnly(user.id);
    if (activeBasket) {
      const view = await getBasketView(activeBasket.id);
      haveIds = new Set((view?.basket.items ?? []).map((i) => i.productId));
    }
  }

  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    summary: recipe.summary,
    instructions: recipe.instructions,
    ingredients: recipe.ingredientProductIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        productId: p.id,
        name: p.name,
        imageEmoji: p.imageEmoji,
        cloudinaryPublicId: p.cloudinaryPublicId,
        price: isSubscriber ? p.memberPrice : p.standardPrice,
        have: haveIds.has(p.id),
      })),
  };
}
