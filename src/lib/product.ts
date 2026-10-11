import type { Prisma, Product } from "@/generated/prisma/client";
import type { AddableProduct } from "@/components/cart-provider";
import type { ProductCardData } from "@/components/product-card";

export const FRESH_CUTS_TAG = "fresh-cuts";

/**
 * What Basket still sells. Fresh Cuts (the pre-cut line) is discontinued:
 * its rows stay for past orders, but every list, search and suggestion
 * leaves them out. Spread it into a `where` alongside other conditions.
 */
export const OFFERED: Prisma.ProductWhereInput = { NOT: { tags: { has: FRESH_CUTS_TAG } } };

/** The same test as OFFERED, for a product already in hand. */
export function isOffered(p: { tags: string[] }): boolean {
  return !p.tags.includes(FRESH_CUTS_TAG);
}

/**
 * The most of one product a single cart or basket line may hold. Weighed
 * products count grams (50kg), everything else counts pieces, bunches or
 * packs (200). Generous for any real household, and it stops absurd values
 * (a typo, a tampered request) reaching an order.
 */
export function maxQuantityFor(p: { soldAs: string }): number {
  return p.soldAs === "WEIGHT" ? 50_000 : 200;
}

/** Round a requested quantity up to the product's pack size, then cap it. Returns 0 for nothing. */
export function snapQuantity(quantity: number, p: { minOrderQty: number; stepQty: number; soldAs: string }): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const step = Math.max(1, p.stepQty);
  const above = Math.max(0, Math.trunc(quantity) - p.minOrderQty);
  const snapped = p.minOrderQty + Math.ceil(above / step) * step;
  const max = maxQuantityFor(p);
  // Cap on a pack boundary, so the stored value is always one a customer could have picked.
  return snapped <= max ? snapped : p.minOrderQty + Math.floor((max - p.minOrderQty) / step) * step;
}

export function toAddable(p: Product): AddableProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    unit: p.unit,
    orderUnit: p.orderUnit,
    minOrderQty: p.minOrderQty,
    stepQty: p.stepQty,
    imageEmoji: p.imageEmoji,
    cloudinaryPublicId: p.cloudinaryPublicId,
    memberPrice: p.memberPrice,
    standardPrice: p.standardPrice,
  };
}

export function toCardData(p: Product): ProductCardData {
  return {
    ...toAddable(p),
    inSeason: p.inSeason,
    description: p.description,
    category: p.category,
    tags: p.tags,
  };
}
