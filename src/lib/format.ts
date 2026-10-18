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
  "weight-management": "Eat lighter",
  "post-workout-recovery": "Train better",
  "family-household": "Feed the family",
  "busy-weeks": "Eat well on busy weeks",
  "plant-based": "More plants",
  "fresh-fruit": "Fresh fruit every week",
  // Older accounts only; no longer offered.
  "general-wellness": "Eat well",
  other: "Something else",
};

export const SHOPPING_STYLE_LABEL: Record<string, string> = {
  "one-off": "One-off orders",
  subscription: "Weekly subscription basket",
  "not-sure": "Not sure yet",
};

export const HOUSEHOLD_TYPE_LABEL: Record<string, string> = {
  myself: "Just myself",
  partner: "Partner or spouse",
  "family-kids": "Family with kids",
  housemates: "Housemates",
  mixed: "A mix of people",
};

export const COOK_TIME_LABEL: Record<string, string> = {
  none: "No time to cook",
  unpredictable: "Unpredictable",
  "under-20": "Under 20 minutes",
  "under-30": "Under 30 minutes",
  "up-to-hour": "Up to an hour",
};

export const PRODUCE_PREFERENCE_LABEL: Record<string, string> = {
  fruits: "Fruits",
  vegetables: "Vegetables",
  "leafy-greens": "Leafy greens",
  "root-veg": "Root veg",
  herbs: "Herbs and spices",
};

// Order shown in onboarding. "everything" is the master toggle, handled separately.
export const PRODUCE_PREFERENCE_OPTIONS = [
  "fruits",
  "vegetables",
  "leafy-greens",
  "root-veg",
  "herbs",
] as const;

export const MEAL_FORMAT_LABEL: Record<string, string> = {
  "weeknight-dinners": "Quick weeknight dinners",
  "cook-ahead": "Cook-ahead",
  "packed-lunches": "Packed lunches",
  "prep-breakfasts": "Preppable breakfasts",
};

// Order status labels live in src/lib/order-status.ts.
