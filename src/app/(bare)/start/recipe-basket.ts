import { householdScale, type StarterCandidate } from "@/lib/starter-basket-core";
import type { MenuRecipe } from "../home-menu/recipes";

/**
 * Pure: turns the recipes a new customer picked into their first basket, so
 * the sign-up preview can run it on every tap. Every ingredient Basket stocks
 * goes in once, sized for the household; the rest is listed as "grab it
 * elsewhere", the same split the homepage shows.
 */

export type BasketLine = {
  productId: string;
  slug: string;
  name: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  standardPrice: number;
  minOrderQty: number;
  stepQty: number;
  quantity: number;
  /** Titles of the picked recipes that use it. */
  usedBy: string[];
};

export function snapQuantity(quantity: number, minOrderQty: number, stepQty: number) {
  const above = Math.max(0, quantity - minOrderQty);
  return minOrderQty + Math.ceil(above / stepQty) * stepQty;
}

export function buildRecipeBasket(
  recipes: MenuRecipe[],
  adults: number,
  kids: number,
  candidates: StarterCandidate[],
): { lines: BasketLine[]; elsewhere: string[] } {
  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  // One order unit covers about two people; an ingredient three or more of
  // the week's recipes lean on gets one more.
  const perUnit = Math.max(1, Math.ceil(householdScale(adults, kids) / 2));

  const lines = new Map<string, BasketLine>();
  const elsewhere = new Set<string>();
  for (const r of recipes) {
    for (const slug of r.basket) {
      const c = bySlug.get(slug);
      if (!c) {
        // A slug the catalogue no longer stocks is still an ingredient.
        elsewhere.add(slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "));
        continue;
      }
      const line = lines.get(slug);
      if (line) line.usedBy.push(r.title);
      else
        lines.set(slug, {
          productId: c.id,
          slug,
          name: c.name,
          imageEmoji: c.imageEmoji,
          cloudinaryPublicId: c.cloudinaryPublicId,
          standardPrice: c.standardPrice,
          minOrderQty: c.minOrderQty,
          stepQty: c.stepQty,
          quantity: 0,
          usedBy: [r.title],
        });
    }
    for (const e of r.elsewhere) elsewhere.add(e);
  }

  for (const line of lines.values()) {
    const units = perUnit + (line.usedBy.length >= 3 ? 1 : 0);
    line.quantity = snapQuantity(line.minOrderQty * units, line.minOrderQty, line.stepQty);
  }

  // The ingredients the most recipes share first: they are the week's backbone.
  const sorted = [...lines.values()].sort((a, b) => b.usedBy.length - a.usedBy.length || a.name.localeCompare(b.name));
  return { lines: sorted, elsewhere: [...elsewhere] };
}
