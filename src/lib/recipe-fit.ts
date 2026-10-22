import "server-only";
import { prisma } from "@/lib/prisma";
import { priceFor } from "@/lib/order-container";
import { BUYABLE } from "@/lib/product";
import type { MenuRecipe } from "@/lib/menu-types";
import type { CookRecipe } from "@/app/(site)/basket/cook-this-week";

type Buyable = { slug: string; memberPrice: number; standardPrice: number; minOrderQty: number };

/** The products we can bring for these recipes, by slug. */
export async function buyableFor(recipes: MenuRecipe[]) {
  const rows = await prisma.product.findMany({
    where: { slug: { in: [...new Set(recipes.flatMap((r) => r.basket))] }, ...BUYABLE },
    select: { slug: true, memberPrice: true, standardPrice: true, minOrderQty: true },
  });
  return new Map(rows.map((p) => [p.slug, p]));
}

/**
 * How close a basket is to a recipe: how many of its ingredients are in,
 * how many we can bring that aren't, and what those would cost.
 */
export function fitRecipe(r: MenuRecipe, inBasket: Set<string>, buyable: Map<string, Buyable>, member: boolean): CookRecipe {
  const have = r.basket.filter((s) => inBasket.has(s)).length;
  const missing = r.basket.filter((s) => !inBasket.has(s) && buyable.has(s));
  const needCost = missing.reduce((sum, s) => {
    const p = buyable.get(s)!;
    return sum + priceFor(p, member) * p.minOrderQty;
  }, 0);
  return { id: r.id ?? null, slug: r.slug, title: r.title, image: r.image, minutes: r.minutes, have, total: r.basket.length, need: missing.length, needCost };
}
