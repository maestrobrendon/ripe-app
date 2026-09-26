import type { Product } from "@/generated/prisma/client";
import type { AddableProduct } from "@/components/cart-provider";
import type { ProductCardData } from "@/components/product-card";

export const FRESH_CUTS_TAG = "fresh-cuts";

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
  };
}
