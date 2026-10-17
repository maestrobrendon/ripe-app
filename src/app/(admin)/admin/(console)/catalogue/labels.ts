import type { Availability, ProductCategory } from "@/generated/prisma/enums";

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  AVAILABLE: "On sale",
  LIMITED: "Limited",
  OUT_OF_STOCK: "Out of stock",
  HIDDEN: "Hidden",
};

export const AVAILABILITY_HINT: Record<Availability, string> = {
  AVAILABLE: "On the site and in stock.",
  LIMITED: "On sale, shown as limited this season.",
  OUT_OF_STOCK: "Shown, but can't be added to a cart or basket.",
  HIDDEN: "Off the site entirely. New products start here.",
};

export function availabilityTone(a: Availability): "good" | "warn" | "bad" | "neutral" {
  return a === "AVAILABLE" ? "good" : a === "LIMITED" ? "warn" : a === "OUT_OF_STOCK" ? "bad" : "neutral";
}

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  FRUIT: "Fruit",
  VEGETABLE: "Vegetable",
  BOX_BUNDLE: "Box or bundle",
  SEASONAL: "Seasonal",
};
