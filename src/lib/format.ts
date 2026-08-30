const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return nairaFormatter.format(amount);
}

export const DELIVERY_DAY_LABEL: Record<string, string> = {
  MONDAY: "Monday",
  WEDNESDAY: "Wednesday",
  FRIDAY: "Friday",
};

export const CATEGORY_LABEL: Record<string, string> = {
  FRUIT: "Fruits",
  VEGETABLE: "Vegetables",
  BOX_BUNDLE: "Boxes & Baskets",
  SEASONAL: "Seasonal",
};

export const ORDER_UNIT_LABEL: Record<string, string> = {
  PIECE: "per piece",
  PAIR: "per pair",
  WEIGHT: "by weight",
};

export const GOAL_LABEL: Record<string, string> = {
  "general-wellness": "General wellness",
  "weight-management": "Weight management",
  "post-workout-recovery": "Post-workout recovery",
  "family-household": "Family and household eating",
  other: "Something else",
};

export const SHOPPING_STYLE_LABEL: Record<string, string> = {
  "one-off": "One-off orders",
  subscription: "Weekly subscription basket",
  "not-sure": "Not sure yet",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Received",
  SOURCED: "Sourced",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

export const ORDER_STATUS_STEPS = [
  "RECEIVED",
  "SOURCED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;
