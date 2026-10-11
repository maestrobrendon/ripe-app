/**
 * The cooking detail behind each menu recipe (src/app/(bare)/home-menu/recipes.ts):
 * how much of each ingredient, and what to cook it in. Kept beside the recipe
 * page rather than on MenuRecipe so the homepage and sign-up, which never
 * show amounts, don't carry it.
 *
 * Amounts are for the recipe's own `serves` and scale linearly with the
 * servings switch. Keys are a basket slug or an `elsewhere` label exactly as
 * written in MENU. A unit of "" means a count ("2 tomatoes").
 */

export type Amount = readonly [qty: number, unit: string];

export type MenuDetail = {
  amounts: Record<string, Amount>;
  tools: string[];
};

export const MENU_DETAILS: Record<string, MenuDetail> = {
  "chicken-shawarma-bowl": {
    amounts: {
      "romaine-lettuce": [1, "head"],
      tomato: [2, ""],
      cucumber: [1, ""],
      onion: [1, ""],
      cabbage: [0.25, "head"],
      parsley: [1, "handful"],
      lime: [2, ""],
      chilli: [1, ""],
      "Chicken thighs": [400, "g"],
      "Plain yoghurt": [150, "g"],
    },
    tools: ["Large frying pan", "Chopping board", "Sharp knife", "Small bowl"],
  },
  "green-mango-crunch-salad": {
    amounts: {
      "green-mango": [2, ""],
      carrot: [2, ""],
      cabbage: [0.25, "head"],
      tomato: [6, "small"],
      chilli: [1, ""],
      lime: [2, ""],
      mint: [1, "handful"],
      "Roasted groundnuts": [50, "g"],
    },
    tools: ["Peeler", "Mortar and pestle or a jar", "Large bowl", "Sharp knife"],
  },
  "watermelon-cucumber-salad": {
    amounts: {
      watermelon: [0.25, ""],
      cucumber: [1, ""],
      mint: [1, "handful"],
      lime: [1, ""],
      onion: [0.5, ""],
      "Feta or wara cheese": [100, "g"],
    },
    tools: ["Large bowl", "Sharp knife", "Chopping board"],
  },
  "sweet-potato-burrito-bowl": {
    amounts: {
      "sweet-potato": [2, ""],
      corn: [2, "cob"],
      tomato: [2, ""],
      onion: [1, ""],
      avocado: [1, ""],
      lime: [2, ""],
      chilli: [1, ""],
      parsley: [1, "handful"],
      "Black beans": [400, "g tin"],
      Rice: [150, "g"],
    },
    tools: ["Baking tray", "Frying pan", "Medium pot", "Fork for mashing"],
  },
  "mango-passion-smoothie-bowl": {
    amounts: {
      mango: [1, ""],
      banana: [2, ""],
      pineapple: [0.25, ""],
      "passion-fruit": [2, ""],
      blueberries: [1, "handful"],
      dates: [2, ""],
      "Greek yoghurt": [150, "g"],
      Oats: [30, "g"],
    },
    tools: ["Blender", "Freezer bag", "Bowl"],
  },
  "suya-beef-lettuce-wraps": {
    amounts: {
      "iceberg-lettuce": [1, "head"],
      tomato: [2, ""],
      onion: [1, ""],
      cucumber: [1, ""],
      chilli: [1, ""],
      lime: [1, ""],
      "bell-pepper": [1, ""],
      "Beef strips": [350, "g"],
      "Suya spice": [2, "tbsp"],
    },
    tools: ["Heavy frying pan", "Chopping board", "Sharp knife"],
  },
  "garden-egg-shakshuka": {
    amounts: {
      tomato: [6, ""],
      "bell-pepper": [2, ""],
      onion: [1, ""],
      "garden-egg": [4, ""],
      chilli: [1, ""],
      parsley: [1, "handful"],
      Eggs: [6, ""],
      "Bread to dip": [1, "loaf"],
    },
    tools: ["Large deep pan with a lid", "Chopping board", "Wooden spoon"],
  },
  "ginger-vegetable-stir-fry": {
    amounts: {
      carrot: [2, ""],
      cabbage: [0.5, "head"],
      "bell-pepper": [2, ""],
      onion: [1, ""],
      mushrooms: [250, "g"],
      ginger: [1, "thumb"],
      chilli: [1, ""],
      Noodles: [300, "g"],
      "Soy sauce": [3, "tbsp"],
    },
    tools: ["Wok or large frying pan", "Medium pot", "Grater", "Sharp knife"],
  },
  "grilled-fish-pepper-salsa": {
    amounts: {
      tomato: [3, ""],
      "bell-pepper": [1, ""],
      onion: [1, ""],
      chilli: [1, ""],
      lime: [3, ""],
      cucumber: [1, ""],
      parsley: [1, "handful"],
      "Croaker or tilapia": [2, "whole fish"],
    },
    tools: ["Grill or oven tray", "Small bowl", "Sharp knife"],
  },
  "avocado-dodo-toast": {
    amounts: {
      avocado: [1, ""],
      plantain: [1, "ripe"],
      tomato: [1, ""],
      onion: [0.5, ""],
      chilli: [0.5, ""],
      lime: [1, ""],
      Eggs: [2, ""],
      Sourdough: [2, "slice"],
    },
    tools: ["Frying pan", "Toaster or grill", "Fork for mashing"],
  },
  "beetroot-orange-salad": {
    amounts: {
      beetroot: [3, ""],
      orange: [2, ""],
      "salad-mix": [1, "bag"],
      onion: [0.5, ""],
      mint: [1, "handful"],
      lime: [1, ""],
      "Feta or wara cheese": [100, "g"],
    },
    tools: ["Medium pot or baking tray", "Small bowl", "Sharp knife"],
  },
  "mushroom-spinach-frittata": {
    amounts: {
      mushrooms: [250, "g"],
      spinach: [1, "bunch"],
      onion: [1, ""],
      tomato: [2, ""],
      thyme: [4, "sprig"],
      Eggs: [8, ""],
    },
    tools: ["Ovenproof frying pan", "Mixing bowl", "Whisk or fork"],
  },
};

/** Units that change in the plural. "tbsp", "ripe", "small" and "whole fish" don't. */
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
