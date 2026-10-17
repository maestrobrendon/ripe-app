import type { Product } from "@/generated/prisma/client";
import type { ProductDetails } from "./actions";

/* The product form's shape, shared by the editor (client) and its pages (server). */

export type DetailsDraft = Required<{ [K in keyof ProductDetails]: Exclude<ProductDetails[K], undefined> }>;

export const EMPTY_DETAILS: DetailsDraft = {
  name: "",
  slug: "",
  category: "FRUIT",
  unit: "",
  orderUnit: "PIECE",
  soldAs: "SINGLE",
  setSize: null,
  referenceWeightG: null,
  minOrderQty: 1,
  stepQty: 1,
  color: null,
  imageEmoji: "🥬",
  source: "Lagos markets",
  featured: false,
  tags: [],
  relatedProductIds: [],
  description: null,
  blurb: null,
  sourcingLine: null,
  educationCopy: null,
  benefitsCopy: null,
  howToEnjoyCopy: null,
  storageTips: null,
};

export function toDetails(p: Product): DetailsDraft {
  return {
    name: p.name,
    slug: p.slug,
    category: p.category,
    unit: p.unit,
    orderUnit: p.orderUnit,
    soldAs: p.soldAs,
    setSize: p.setSize,
    referenceWeightG: p.referenceWeightG,
    minOrderQty: p.minOrderQty,
    stepQty: p.stepQty,
    color: p.color,
    imageEmoji: p.imageEmoji,
    source: p.source,
    featured: p.featured,
    tags: p.tags,
    relatedProductIds: p.relatedProductIds,
    description: p.description,
    blurb: p.blurb,
    sourcingLine: p.sourcingLine,
    educationCopy: p.educationCopy,
    benefitsCopy: p.benefitsCopy,
    howToEnjoyCopy: p.howToEnjoyCopy,
    storageTips: p.storageTips,
  };
}
