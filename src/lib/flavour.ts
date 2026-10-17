import { FRESH_CUTS_TAG } from "@/lib/product";
import type { ProductCategory } from "@/generated/prisma/enums";

/**
 * Category → sticker wash for produce tiles. A mixed grid naturally shows
 * the whole sticker set together (Basket Design System §10.2). Imagery only:
 * never put text on the sunburst wash.
 */
const FLAVOUR_BY_CATEGORY: Record<ProductCategory, string> = {
  FRUIT: "bg-sunburst",
  VEGETABLE: "bg-mint-pop",
  BOX_BUNDLE: "bg-lavender",
  SEASONAL: "bg-ember",
};

export function flavourFor(category: ProductCategory, tags?: string[] | null): string {
  if (tags?.includes(FRESH_CUTS_TAG)) return "bg-electric-blue";
  return FLAVOUR_BY_CATEGORY[category] ?? "bg-sky-wash";
}
