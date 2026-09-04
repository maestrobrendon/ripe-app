import type { Product } from "@/generated/prisma/client";
import { amountFitsBand } from "@/lib/budget";

export type MealCategory = "soup" | "rice" | "light" | "veggie";

export const MEAL_PREFERENCES: { id: string; label: string; category: MealCategory | "any" }[] = [
  { id: "soups", label: "Nigerian soups", category: "soup" },
  { id: "rice", label: "Rice dishes", category: "rice" },
  { id: "light", label: "Light meals", category: "light" },
  { id: "veggies", label: "Mostly veggies", category: "veggie" },
  { id: "mix", label: "A mix of everything", category: "any" },
];

type DishDef = {
  slug: string;
  name: string;
  category: MealCategory;
  aliases: string[];
  baseServings: number;
  timeMinutes: number;
  /** Produce lines in pack counts at baseServings. productSlug must exist in the catalog. */
  produce: { productSlug: string; packs: number }[];
  /** Non-produce items we do not carry. */
  pantry: string[];
  note: string;
};

const DISHES: DishDef[] = [
  {
    slug: "egusi-soup",
    name: "Egusi Soup",
    category: "soup",
    aliases: ["egusi"],
    baseServings: 4,
    timeMinutes: 60,
    produce: [
      { productSlug: "ugu", packs: 2 },
      { productSlug: "spinach", packs: 1 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["Egusi (melon) seeds", "Palm oil", "Assorted meat or fish", "Crayfish", "Seasoning cubes"],
    note: "The greens go in last so they keep their colour.",
  },
  {
    slug: "efo-riro",
    name: "Efo Riro",
    category: "soup",
    aliases: ["efo riro", "efo", "vegetable soup"],
    baseServings: 4,
    timeMinutes: 45,
    produce: [
      { productSlug: "spinach", packs: 2 },
      { productSlug: "ugu", packs: 1 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["Palm oil", "Locust beans (iru)", "Assorted meat", "Crayfish", "Seasoning cubes"],
    note: "Cook the pepper base down until the oil rises before the greens go in.",
  },
  {
    slug: "ogbono-soup",
    name: "Ogbono Soup",
    category: "soup",
    aliases: ["ogbono", "draw soup"],
    baseServings: 4,
    timeMinutes: 50,
    produce: [
      { productSlug: "ugu", packs: 2 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["Ogbono seeds", "Palm oil", "Meat or fish", "Crayfish", "Seasoning cubes"],
    note: "Loosen the ogbono in a little oil before adding stock.",
  },
  {
    slug: "vegetable-pepper-soup",
    name: "Vegetable Pepper Soup",
    category: "soup",
    aliases: ["pepper soup", "peppersoup"],
    baseServings: 4,
    timeMinutes: 40,
    produce: [
      { productSlug: "scent-leaf", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
      { productSlug: "ginger", packs: 1 },
    ],
    pantry: ["Pepper soup spice", "Fish or goat meat", "Seasoning cubes"],
    note: "Stir the scent leaf in right at the end, off the heat.",
  },
  {
    slug: "jollof-rice",
    name: "Jollof Rice",
    category: "rice",
    aliases: ["jollof"],
    baseServings: 6,
    timeMinutes: 50,
    produce: [
      { productSlug: "tomato", packs: 2 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
      { productSlug: "carrot", packs: 1 },
    ],
    pantry: ["Long-grain rice", "Vegetable oil", "Tomato paste", "Seasoning cubes", "Bay leaves", "Curry and thyme", "Chicken or beef"],
    note: "Fry the blended base hard before the rice goes in.",
  },
  {
    slug: "fried-rice",
    name: "Fried Rice",
    category: "rice",
    aliases: ["fried rice"],
    baseServings: 6,
    timeMinutes: 45,
    produce: [
      { productSlug: "carrot", packs: 2 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "cabbage", packs: 1 },
      { productSlug: "onion", packs: 1 },
      { productSlug: "spinach", packs: 1 },
    ],
    pantry: ["Long-grain rice", "Vegetable oil", "Curry powder", "Green peas and sweetcorn", "Liver", "Chicken"],
    note: "Cook the vegetables hot and fast so they stay crisp.",
  },
  {
    slug: "vegetable-stir-fry",
    name: "Vegetable Stir-fry",
    category: "veggie",
    aliases: ["stir fry", "stir-fry", "stirfry"],
    baseServings: 3,
    timeMinutes: 20,
    produce: [
      { productSlug: "stir-fry-veg-mix", packs: 1 },
      { productSlug: "spinach", packs: 1 },
    ],
    pantry: ["Soy sauce", "Vegetable oil", "Garlic", "Protein (optional)"],
    note: "One pan, high heat, keep it moving.",
  },
  {
    slug: "plantain-and-egg-sauce",
    name: "Plantain and Egg Sauce",
    category: "light",
    aliases: ["plantain and egg", "dodo and egg", "egg sauce", "plantain"],
    baseServings: 2,
    timeMinutes: 20,
    produce: [
      { productSlug: "plantain", packs: 4 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["Eggs", "Vegetable oil", "Seasoning cubes"],
    note: "Fry the plantain deep gold, drain, then build the sauce.",
  },
  {
    slug: "sweet-potato-pottage",
    name: "Sweet Potato Pottage",
    category: "light",
    aliases: ["sweet potato pottage", "potato porridge", "pottage", "porridge"],
    baseServings: 4,
    timeMinutes: 40,
    produce: [
      { productSlug: "sweet-potato", packs: 2 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
      { productSlug: "ugu", packs: 1 },
    ],
    pantry: ["Palm oil", "Crayfish", "Dried fish", "Seasoning cubes"],
    note: "Simmer until the sweet potato just softens, then fold the greens in.",
  },
  {
    slug: "garden-egg-sauce",
    name: "Garden Egg Sauce",
    category: "veggie",
    aliases: ["garden egg"],
    baseServings: 4,
    timeMinutes: 30,
    produce: [
      { productSlug: "garden-egg", packs: 1 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["Palm oil", "Crayfish", "Fish", "Seasoning cubes"],
    note: "Boil and mash the garden egg, then stir it through the fried base.",
  },
  {
    slug: "fresh-coleslaw",
    name: "Fresh Coleslaw",
    category: "light",
    aliases: ["coleslaw", "slaw"],
    baseServings: 4,
    timeMinutes: 10,
    produce: [{ productSlug: "coleslaw-mix", packs: 1 }],
    pantry: ["Mayonnaise", "A little sugar", "Salt"],
    note: "Dress only what you will eat now so it stays crisp.",
  },
  {
    slug: "family-fruit-salad",
    name: "Family Fruit Salad",
    category: "light",
    aliases: ["fruit salad", "fruit plate"],
    baseServings: 4,
    timeMinutes: 15,
    produce: [
      { productSlug: "pawpaw", packs: 1 },
      { productSlug: "pineapple", packs: 1 },
      { productSlug: "watermelon", packs: 1 },
      { productSlug: "banana", packs: 1 },
      { productSlug: "orange", packs: 2 },
      { productSlug: "lime", packs: 1 },
    ],
    pantry: [],
    note: "A squeeze of lime keeps the cut fruit bright.",
  },
  {
    slug: "blender-smoothies",
    name: "Blender Smoothies",
    category: "light",
    aliases: ["smoothie", "smoothies"],
    baseServings: 2,
    timeMinutes: 5,
    produce: [
      { productSlug: "pineapple", packs: 1 },
      { productSlug: "banana", packs: 1 },
      { productSlug: "mango", packs: 2 },
      { productSlug: "ginger", packs: 1 },
    ],
    pantry: ["Milk or yoghurt", "Honey (optional)"],
    note: "Freeze the fruit first for a thicker blend.",
  },
];

export const MEAL_EXAMPLE_PROMPTS = [
  "Egusi soup for 4",
  "Jollof rice for 6",
  "Plantain and egg sauce for 2",
  "Fruit salad for the family",
];

function snapQty(raw: number, minOrderQty: number, stepQty: number): number {
  const above = Math.max(0, raw - minOrderQty);
  return minOrderQty + Math.ceil(above / stepQty) * stepQty;
}

export type PlanLine = {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  quantity: number;
  lineCost: number;
};

export type MealPlan = {
  dishSlug: string;
  dishName: string;
  servings: number;
  timeMinutes: number;
  note: string;
  inCatalog: PlanLine[];
  alsoNeed: string[];
  produceTotal: number;
};

function build(dish: DishDef, servings: number, products: Product[]): MealPlan {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const scale = servings / dish.baseServings;

  const inCatalog: PlanLine[] = [];
  for (const pr of dish.produce) {
    const product = bySlug.get(pr.productSlug);
    if (!product) continue;
    const rawPacks = Math.max(1, Math.round(pr.packs * scale));
    const quantity = snapQty(rawPacks, product.minOrderQty, product.stepQty);
    const lineCost = product.standardPrice * quantity;
    inCatalog.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unit: product.unit,
      imageEmoji: product.imageEmoji,
      cloudinaryPublicId: product.cloudinaryPublicId,
      quantity,
      lineCost,
    });
  }

  return {
    dishSlug: dish.slug,
    dishName: dish.name,
    servings,
    timeMinutes: dish.timeMinutes,
    note: dish.note,
    inCatalog,
    alsoNeed: dish.pantry,
    produceTotal: inCatalog.reduce((s, l) => s + l.lineCost, 0),
  };
}

function parseServings(text: string): number | null {
  const m =
    text.match(/\bfor\s+(\d{1,2})\b/) ??
    text.match(/\b(\d{1,2})\s*(?:people|persons?|pax|servings?|plates?)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 20 ? n : null;
}

/** Path 1: parse a free-text request like "Egusi soup for 4". */
export function planFromText(text: string, products: Product[]): MealPlan | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  const dish = DISHES.find((d) => d.aliases.some((a) => t.includes(a)));
  if (!dish) return null;
  return build(dish, parseServings(t) ?? dish.baseServings, products);
}

/** Path 2: guided "Surprise me" pick from a preference and budget band. */
export function planSurprise(
  {
    preferenceId,
    budgetBandId,
    servings,
    excludeSlug,
  }: {
    preferenceId?: string;
    budgetBandId?: string;
    servings?: number;
    excludeSlug?: string;
  },
  products: Product[],
): MealPlan | null {
  const pref = MEAL_PREFERENCES.find((p) => p.id === preferenceId);
  const wanted = !pref || pref.category === "any" ? null : pref.category;

  let pool = DISHES.filter((d) => (wanted ? d.category === wanted : true) && d.slug !== excludeSlug);
  if (pool.length === 0) pool = DISHES.filter((d) => d.slug !== excludeSlug);

  const inBudget = pool.filter((d) => {
    const total = build(d, servings ?? d.baseServings, products).produceTotal;
    return amountFitsBand(total, budgetBandId);
  });
  const candidates = inBudget.length > 0 ? inBudget : pool;

  const dish = candidates[Math.floor(Math.random() * candidates.length)];
  if (!dish) return null;
  return build(dish, servings ?? dish.baseServings, products);
}
