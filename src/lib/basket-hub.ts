import { prisma } from "@/lib/prisma";
import { GOAL_LABEL } from "@/lib/format";
import type { Product, ProductCategory } from "@/generated/prisma/client";

/**
 * Cumulative Naira saved vs standard pricing across every past order line.
 * Computed, never stored.
 */
export async function computeCumulativeSavings(userId: string): Promise<number> {
  const items = await prisma.orderItem.findMany({
    where: { order: { userId } },
    include: { product: { select: { standardPrice: true } } },
  });
  return items.reduce(
    (sum, i) => sum + Math.max(0, i.product.standardPrice - i.unitPrice) * i.quantity,
    0,
  );
}

const CATEGORY_FRUIT: ProductCategory[] = ["FRUIT", "SEASONAL"];

export function computeGoalFit(
  categories: ProductCategory[],
  goal: string | null | undefined,
): string | null {
  if (!goal) return null;
  const set = new Set(categories);
  const hasFruit = CATEGORY_FRUIT.some((c) => set.has(c)) || set.has("BOX_BUNDLE");
  const hasVeg = set.has("VEGETABLE") || set.has("BOX_BUNDLE");
  const label = (GOAL_LABEL[goal] ?? goal).toLowerCase();

  switch (goal) {
    case "weight-management":
      return hasVeg
        ? `On track for ${label}`
        : `Add vegetables to fit ${label}`;
    case "post-workout-recovery":
      return hasFruit
        ? `On track for ${label}`
        : `Add fruit for ${label}`;
    case "family-household":
      return hasFruit && hasVeg
        ? `Balanced for ${label}`
        : `Add more variety for ${label}`;
    default:
      return hasFruit && hasVeg
        ? `Balanced for ${label}`
        : `Add ${!hasFruit ? "fruit" : "vegetables"} for ${label}`;
  }
}

/**
 * Favorites and frequently ordered items that are in season and not already in
 * the basket. One-tap add shelf.
 */
export async function getQuickAddItems(
  userId: string,
  favoriteProductIds: string[],
  excludeProductIds: string[],
  limit = 8,
): Promise<Product[]> {
  const [orderItems, favorites] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { userId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 20,
    }),
    favoriteProductIds.length
      ? prisma.product.findMany({ where: { id: { in: favoriteProductIds } } })
      : Promise.resolve([] as Product[]),
  ]);

  const exclude = new Set(excludeProductIds);
  const orderedIds = orderItems.map((o) => o.productId).filter((id) => !exclude.has(id));

  const rankedIds = [
    ...favorites.map((f) => f.id).filter((id) => !exclude.has(id)),
    ...orderedIds,
  ];
  const seen = new Set<string>();
  const finalIds = rankedIds.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));

  let products = finalIds.length
    ? await prisma.product.findMany({ where: { id: { in: finalIds }, inSeason: true } })
    : [];

  // Deterministic seasonal fallback so the shelf is never empty for new members.
  if (products.length < limit) {
    const fill = await prisma.product.findMany({
      where: {
        inSeason: true,
        featured: true,
        id: { notIn: [...exclude, ...products.map((p) => p.id)] },
      },
      take: limit - products.length,
      orderBy: { name: "asc" },
    });
    products = [...products, ...fill];
  }

  const order = new Map(finalIds.map((id, i) => [id, i]));
  products.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  return products.slice(0, limit);
}

export type FlaggedSwap = {
  productId: string;
  reason: string;
  swapToId: string;
  swapToName: string;
  swapToEmoji: string;
};

/** Out-of-season basket items, each paired with an in-season swap in the same category. */
export function getFlaggedSwaps(
  basketItems: { productId: string; product: Product }[],
  allProducts: Product[],
): FlaggedSwap[] {
  const inBasket = new Set(basketItems.map((i) => i.productId));
  const flags: FlaggedSwap[] = [];

  for (const item of basketItems) {
    if (item.product.inSeason) continue;
    const swap = allProducts.find(
      (p) => p.category === item.product.category && p.inSeason && !inBasket.has(p.id),
    );
    if (!swap) continue;
    flags.push({
      productId: item.productId,
      reason: "Out of season this week",
      swapToId: swap.id,
      swapToName: swap.name,
      swapToEmoji: swap.imageEmoji,
    });
  }
  return flags;
}
