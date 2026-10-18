/**
 * The menu's shape, and the six goals it's organised around. Client-safe.
 *
 * Global dishes, light prep, rebuilt around what Basket actually stocks:
 * every `basket` entry is a real catalogue slug, so pages can show the
 * product's own name and photo, and the "N of M from Basket" count is honest.
 * `elsewhere` is what the customer picks up on their own (proteins, grains,
 * dairy, sauces). Pantry basics like salt, oil and black pepper are left out
 * of both counts.
 *
 * The recipes themselves live in the Recipe table and are edited in the
 * admin; servers read them with getMenu() in src/lib/menu.ts.
 */

export type MenuGoal = "lighter" | "training" | "family" | "busy" | "plants" | "fruit";

export type MenuRecipe = {
  /** The Recipe row, when it came from the database (for saving). */
  id?: string;
  slug: string;
  title: string;
  /** One line, what makes it worth cooking. */
  hook: string;
  goal: MenuGoal;
  minutes: number;
  serves: number;
  image: string;
  /** What the photo shows, for alt text. */
  alt: string;
  /** Catalogue slugs, in the order the recipe uses them. */
  basket: string[];
  elsewhere: string[];
  /** Empty for a members-only recipe on a page a guest can see (see getGuestMenu). */
  steps: string[];
  /** Members get the method; everyone else sees the dish and its ingredients. */
  membersOnly?: boolean;
};

/**
 * Why people come to Basket, food first and never medical. Each maps to a
 * starter-basket slug (starter-basket-core) and Kachi's goal vocabulary.
 * "general-wellness" survives only as the fallback for older accounts.
 */
/** `short` is for chips and tabs, where six full labels would crowd the row. */
export const MENU_GOALS: { id: MenuGoal; label: string; short: string; prompt: string; starterSlug: string }[] = [
  { id: "lighter", label: "Eat lighter", short: "Eat lighter", prompt: "I want to lose a little weight without feeling hungry.", starterSlug: "weight-management" },
  { id: "training", label: "Train better", short: "Train better", prompt: "I train most days and need to eat for it.", starterSlug: "post-workout-recovery" },
  { id: "family", label: "Feed the family", short: "Feed the family", prompt: "Dinners for four that the kids will actually eat.", starterSlug: "family-household" },
  { id: "busy", label: "Eat well on busy weeks", short: "Busy weeks", prompt: "Long days. I need quick, fresh meals I'll actually make.", starterSlug: "busy-weeks" },
  { id: "plants", label: "More plants", short: "More plants", prompt: "I want more plant-based meals in my week.", starterSlug: "plant-based" },
  { id: "fruit", label: "Fresh fruit every week", short: "Fresh fruit", prompt: "Fruit on hand for breakfasts, snacks and lunchboxes.", starterSlug: "fresh-fruit" },
];

export type Amount = readonly [qty: number, unit: string];

/** How much of each ingredient (for the recipe's own serves), and what to cook it in. */
export type MenuDetail = { amounts: Record<string, Amount>; tools: string[] };

const PLURAL: Record<string, string> = {
  head: "heads",
  handful: "handfuls",
  bunch: "bunches",
  sprig: "sprigs",
  slice: "slices",
  thumb: "thumbs",
  bag: "bags",
  loaf: "loaves",
  cob: "cobs",
  clove: "cloves",
  cup: "cups",
  stalk: "stalks",
  can: "cans",
  leaf: "leaves",
  pinch: "pinches",
};

const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

/**
 * "1.5" reads as "1½" and "0.25" as "¼". Big gram weights round to the
 * nearest 10 and everything else to the nearest quarter, since nobody
 * measures 3.07 tomatoes.
 */
export function formatQty(qty: number, unit: string) {
  if (unit === "g" || unit === "g tin") {
    const rounded = qty >= 100 ? Math.round(qty / 10) * 10 : Math.round(qty);
    return `${rounded}${unit === "g" ? "g" : " g tin"}`;
  }
  const whole = Math.floor(qty + 0.01);
  const rest = qty - whole;
  const frac = FRACTIONS.find(([v]) => Math.abs(v - rest) < 0.09)?.[1];
  const rounded = frac ? `${whole || ""}${frac}` : String(Math.max(1, Math.round(qty * 4) / 4)).replace(/\.0+$/, "");
  return unit ? `${rounded} ${qty > 1 ? (PLURAL[unit] ?? unit) : unit}` : rounded;
}
