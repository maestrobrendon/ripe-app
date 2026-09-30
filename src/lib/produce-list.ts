import "server-only";
import { prisma } from "@/lib/prisma";
import { classifyPrep, type PrepGroup } from "@/lib/produce-variety";
import type { Product, ProductCategory } from "@/generated/prisma/client";

export type ProduceListLine = {
  productId: string;
  name: string;
  unit: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  quantity: number;
  unitPrice: number;
  prep: PrepGroup;
};

/**
 * How much a goal leans on each real product category — the same goal
 * vocabulary Recipes already uses (GOALS/GOAL_LABEL), reused here instead of
 * inventing a second taxonomy. No specific product is named: this only ranks
 * whatever's actually in season in the catalog.
 */
const GOAL_CATEGORY_WEIGHT: Record<string, Partial<Record<ProductCategory, number>>> = {
  "weight-management": { VEGETABLE: 3, FRUIT: 1, SEASONAL: 1 },
  "post-workout-recovery": { FRUIT: 3, VEGETABLE: 2, SEASONAL: 1 },
  "family-household": { FRUIT: 2, VEGETABLE: 2, SEASONAL: 1 },
  "general-wellness": { FRUIT: 2, VEGETABLE: 2, SEASONAL: 2 },
};

function snapQty(raw: number, minOrderQty: number, stepQty: number): number {
  const above = Math.max(0, raw - minOrderQty);
  return minOrderQty + Math.ceil(above / stepQty) * stepQty;
}

function toLine(p: Product, people: number, isSubscriber: boolean): ProduceListLine {
  const quantity = snapQty(Math.max(1, Math.round(people / 2)), p.minOrderQty, p.stepQty);
  return {
    productId: p.id,
    name: p.name,
    unit: p.unit,
    imageEmoji: p.imageEmoji,
    cloudinaryPublicId: p.cloudinaryPublicId,
    quantity,
    unitPrice: isSubscriber ? p.memberPrice : p.standardPrice,
    prep: classifyPrep({ slug: p.slug, category: p.category }),
  };
}

/** Builds this week's produce list for a household size and a goal, ranked from the real in-season catalog. */
export async function buildProduceList(
  goal: string,
  people: number,
  isSubscriber: boolean,
): Promise<ProduceListLine[]> {
  const weight = GOAL_CATEGORY_WEIGHT[goal] ?? GOAL_CATEGORY_WEIGHT["general-wellness"];
  const products = await prisma.product.findMany({
    where: { inSeason: true, category: { in: ["FRUIT", "VEGETABLE", "SEASONAL"] } },
  });

  const ranked = products
    .filter((p) => (weight[p.category] ?? 0) > 0)
    .sort((a, b) => {
      const w = (weight[b.category] ?? 0) - (weight[a.category] ?? 0);
      if (w !== 0) return w;
      return Number(b.featured) - Number(a.featured);
    })
    .slice(0, 9);

  return ranked.map((p) => toLine(p, people, isSubscriber));
}
