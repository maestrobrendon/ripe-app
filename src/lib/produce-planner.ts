import type { Product } from "@/generated/prisma/client";

/**
 * The Produce Planner. Ripe only sells fruit and vegetables, so every idea here
 * is a produce preparation: a blend, a salad, a roast tray, a quick sauté, a
 * fruit plate, a batch of base, a week of cut fruit. Pantry lists stay to
 * ordinary basics (oil, salt, lime, yoghurt) because the produce is the dish.
 */

export type IdeaKind = "blend" | "salad" | "roast" | "saute" | "plate" | "prep" | "board";

export const KIND_LABEL: Record<IdeaKind, string> = {
  blend: "Blend",
  salad: "Salad",
  roast: "Roast tray",
  saute: "Quick sauté",
  plate: "Plate",
  prep: "Week prep",
  board: "Snack board",
};

type IdeaDef = {
  slug: string;
  name: string;
  kind: IdeaKind;
  aliases: string[];
  baseServings: number;
  timeMinutes: number;
  /** productSlug + pack count at baseServings. */
  produce: { productSlug: string; packs: number }[];
  /** Ordinary kitchen basics we do not sell. Keep this short. */
  pantry: string[];
  method: string;
  tags: string[];
};

const IDEAS: IdeaDef[] = [
  {
    slug: "everyday-fruit-plate",
    name: "Everyday fruit plate",
    kind: "plate",
    aliases: ["fruit plate", "fruit platter", "fruit bowl"],
    baseServings: 4,
    timeMinutes: 10,
    produce: [
      { productSlug: "pawpaw", packs: 1 },
      { productSlug: "pineapple", packs: 1 },
      { productSlug: "banana", packs: 1 },
      { productSlug: "orange", packs: 2 },
      { productSlug: "lime", packs: 1 },
    ],
    pantry: [],
    method: "Slice everything, arrange on a board, finish with a squeeze of lime.",
    tags: ["breakfast", "family", "fruit", "quick"],
  },
  {
    slug: "tropical-blend",
    name: "Tropical blend",
    kind: "blend",
    aliases: ["tropical smoothie", "tropical blend"],
    baseServings: 2,
    timeMinutes: 5,
    produce: [
      { productSlug: "pineapple", packs: 1 },
      { productSlug: "banana", packs: 1 },
      { productSlug: "mango", packs: 2 },
      { productSlug: "ginger", packs: 1 },
    ],
    pantry: ["milk or yoghurt"],
    method: "Chop and freeze the fruit, then blend with milk or yoghurt and a little grated ginger.",
    tags: ["fruit", "quick", "recovery", "breakfast"],
  },
  {
    slug: "green-recovery-blend",
    name: "Green recovery blend",
    kind: "blend",
    aliases: ["green smoothie", "recovery smoothie", "post workout smoothie"],
    baseServings: 2,
    timeMinutes: 5,
    produce: [
      { productSlug: "spinach", packs: 1 },
      { productSlug: "banana", packs: 1 },
      { productSlug: "pineapple", packs: 1 },
      { productSlug: "ginger", packs: 1 },
    ],
    pantry: ["yoghurt or water"],
    method: "Blend the greens first with liquid, then add the fruit and ginger.",
    tags: ["greens", "recovery", "wellness"],
  },
  {
    slug: "ugu-light-juice",
    name: "Ugu light juice",
    kind: "blend",
    aliases: ["ugu juice", "vegetable juice", "green juice"],
    baseServings: 2,
    timeMinutes: 5,
    produce: [
      { productSlug: "ugu", packs: 1 },
      { productSlug: "pineapple", packs: 1 },
      { productSlug: "ginger", packs: 1 },
    ],
    pantry: ["water"],
    method: "Blend ugu with pineapple, ginger and water, then strain for a light green juice.",
    tags: ["greens", "wellness"],
  },
  {
    slug: "watermelon-lime-cooler",
    name: "Watermelon and lime cooler",
    kind: "blend",
    aliases: ["watermelon juice", "watermelon cooler", "watermelon drink"],
    baseServings: 4,
    timeMinutes: 5,
    produce: [
      { productSlug: "watermelon", packs: 1 },
      { productSlug: "lime", packs: 2 },
    ],
    pantry: [],
    method: "Blend cubed watermelon with lime juice, strain if you like it smooth, then chill.",
    tags: ["fruit", "quick"],
  },
  {
    slug: "citrus-avocado-start",
    name: "Citrus and avocado start",
    kind: "plate",
    aliases: ["avocado breakfast", "orange and avocado", "avocado plate"],
    baseServings: 2,
    timeMinutes: 8,
    produce: [
      { productSlug: "orange", packs: 2 },
      { productSlug: "avocado", packs: 2 },
      { productSlug: "lime", packs: 1 },
    ],
    pantry: ["salt"],
    method: "Segment the oranges, slice the avocado, season with salt and a little lime.",
    tags: ["breakfast", "wellness", "quick"],
  },
  {
    slug: "breakfast-fruit-bowl",
    name: "Breakfast fruit bowl",
    kind: "plate",
    aliases: ["breakfast bowl", "morning fruit"],
    baseServings: 2,
    timeMinutes: 8,
    produce: [
      { productSlug: "banana", packs: 1 },
      { productSlug: "mango", packs: 2 },
      { productSlug: "pawpaw", packs: 1 },
    ],
    pantry: ["yoghurt or oats, optional"],
    method: "Chop over yoghurt or oats, or eat it as is.",
    tags: ["breakfast", "fruit", "prep"],
  },
  {
    slug: "garden-salad",
    name: "Garden salad",
    kind: "salad",
    aliases: ["green salad", "mixed salad", "garden salad"],
    baseServings: 4,
    timeMinutes: 15,
    produce: [
      { productSlug: "cucumber", packs: 2 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "cabbage", packs: 1 },
      { productSlug: "carrot", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["oil", "lime", "salt"],
    method: "Shred the cabbage and carrot, slice the rest thin, toss with oil, lime and salt.",
    tags: ["light", "side", "quick"],
  },
  {
    slug: "cucumber-tomato-side",
    name: "Cucumber and tomato side",
    kind: "salad",
    aliases: ["cucumber salad", "tomato salad", "cucumber and tomato"],
    baseServings: 4,
    timeMinutes: 5,
    produce: [
      { productSlug: "cucumber", packs: 2 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "onion", packs: 1 },
      { productSlug: "lime", packs: 1 },
    ],
    pantry: ["oil", "salt"],
    method: "Dice, dress with oil, lime and salt, and rest ten minutes before serving.",
    tags: ["light", "side", "quick", "weight"],
  },
  {
    slug: "quick-coleslaw",
    name: "Quick coleslaw",
    kind: "salad",
    aliases: ["coleslaw", "slaw"],
    baseServings: 4,
    timeMinutes: 10,
    produce: [{ productSlug: "coleslaw-mix", packs: 1 }],
    pantry: ["mayonnaise", "a little sugar", "lime"],
    method: "Stir the mix with mayonnaise, sugar and lime, and dress it just before eating.",
    tags: ["side", "family", "quick"],
  },
  {
    slug: "roast-vegetable-tray",
    name: "Roast vegetable tray",
    kind: "roast",
    aliases: ["roast vegetables", "roasted veg", "vegetable tray", "tray bake"],
    baseServings: 4,
    timeMinutes: 35,
    produce: [
      { productSlug: "sweet-potato", packs: 2 },
      { productSlug: "carrot", packs: 1 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["oil", "salt"],
    method: "Cut into chunks, toss with oil and salt, roast hot for 25 to 30 minutes.",
    tags: ["dinner", "batch", "wellness"],
  },
  {
    slug: "everyday-greens-saute",
    name: "Everyday greens sauté",
    kind: "saute",
    aliases: ["sauteed greens", "greens saute", "greens for soup", "wilted greens"],
    baseServings: 4,
    timeMinutes: 15,
    produce: [
      { productSlug: "spinach", packs: 2 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "onion", packs: 1 },
      { productSlug: "chilli", packs: 1 },
    ],
    pantry: ["oil"],
    method: "Soften onion, tomato and pepper in oil, add the washed greens and cook for two minutes.",
    tags: ["greens", "side", "quick", "wellness", "light"],
  },
  {
    slug: "stir-fry-vegetables",
    name: "Stir-fry vegetables",
    kind: "saute",
    aliases: ["stir fry", "stir-fry", "stirfry"],
    baseServings: 3,
    timeMinutes: 20,
    produce: [
      { productSlug: "stir-fry-veg-mix", packs: 1 },
      { productSlug: "spinach", packs: 1 },
    ],
    pantry: ["soy sauce", "oil", "garlic"],
    method: "Hot pan, oil, garlic, then the mix, then the greens. Keep it moving.",
    tags: ["quick", "dinner", "light"],
  },
  {
    slug: "plantain-and-greens",
    name: "Plantain and greens",
    kind: "plate",
    aliases: ["plantain", "fried plantain", "dodo", "plantain and vegetables"],
    baseServings: 3,
    timeMinutes: 25,
    produce: [
      { productSlug: "plantain", packs: 4 },
      { productSlug: "spinach", packs: 1 },
      { productSlug: "tomato", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: ["oil", "salt"],
    method: "Fry the plantain gold, then a quick sauté of the greens with tomato and onion alongside.",
    tags: ["dinner", "family"],
  },
  {
    slug: "pepper-base-batch",
    name: "Pepper base to batch",
    kind: "prep",
    aliases: ["pepper base", "stew base", "blended pepper", "ata", "obe", "base for jollof", "base for stew"],
    baseServings: 6,
    timeMinutes: 15,
    produce: [
      { productSlug: "tomato", packs: 2 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "chilli", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: [],
    method: "Blend it all smooth, cook down until the water goes, then portion and freeze.",
    tags: ["batch", "prep"],
  },
  {
    slug: "washed-greens-chopped-veg",
    name: "Washed greens and chopped veg",
    kind: "prep",
    aliases: ["meal prep", "veg prep", "prep vegetables", "wash and chop"],
    baseServings: 5,
    timeMinutes: 20,
    produce: [
      { productSlug: "spinach", packs: 1 },
      { productSlug: "ugu", packs: 1 },
      { productSlug: "carrot", packs: 1 },
      { productSlug: "bell-pepper", packs: 1 },
      { productSlug: "onion", packs: 1 },
    ],
    pantry: [],
    method: "Wash and dry the greens, chop the vegetables, and store in tubs so the week is half cooked.",
    tags: ["prep", "batch"],
  },
  {
    slug: "week-of-cut-fruit",
    name: "A week of cut fruit",
    kind: "prep",
    aliases: ["cut fruit", "prepped fruit", "fresh cuts", "week of fruit"],
    baseServings: 5,
    timeMinutes: 20,
    produce: [
      { productSlug: "pineapple-chunks", packs: 1 },
      { productSlug: "watermelon-cubes", packs: 1 },
      { productSlug: "mixed-fruit-cup", packs: 1 },
    ],
    pantry: [],
    method: "Keep the tubs cold and take one a day, or cut a fresh pineapple and melon yourself on Sunday.",
    tags: ["prep", "breakfast", "packed-lunch", "fruit"],
  },
  {
    slug: "snack-board",
    name: "Snack board",
    kind: "board",
    aliases: ["snacks", "snack box", "veg sticks", "crudites"],
    baseServings: 4,
    timeMinutes: 10,
    produce: [
      { productSlug: "carrot", packs: 1 },
      { productSlug: "cucumber", packs: 2 },
      { productSlug: "orange", packs: 2 },
      { productSlug: "banana", packs: 1 },
    ],
    pantry: ["groundnuts, optional"],
    method: "Carrot and cucumber sticks with fruit on the side, kept where everyone can reach.",
    tags: ["snack", "family", "packed-lunch"],
  },
  {
    slug: "corn-and-garden-egg",
    name: "Corn and garden egg",
    kind: "board",
    aliases: ["corn", "garden egg", "roasted corn"],
    baseServings: 4,
    timeMinutes: 30,
    produce: [
      { productSlug: "corn", packs: 2 },
      { productSlug: "garden-egg", packs: 1 },
    ],
    pantry: ["groundnut paste, optional"],
    method: "Boil or roast the corn and serve it with raw garden egg.",
    tags: ["seasonal", "snack"],
  },
  {
    slug: "in-season-fruit-bowl",
    name: "In-season fruit bowl",
    kind: "plate",
    aliases: ["seasonal fruit", "agbalumo", "udara", "star apple"],
    baseServings: 4,
    timeMinutes: 10,
    produce: [
      { productSlug: "agbalumo", packs: 1 },
      { productSlug: "banana", packs: 1 },
      { productSlug: "orange", packs: 2 },
    ],
    pantry: [],
    method: "A simple bowl of what is in season right now, eaten straight from the skin.",
    tags: ["seasonal", "snack", "fruit"],
  },
];

export const PLANNER_GOALS: { id: string; label: string; tag: string }[] = [
  { id: "more-greens", label: "More greens this week", tag: "greens" },
  { id: "more-fruit", label: "More fruit through the week", tag: "fruit" },
  { id: "lighter-meals", label: "Lighter dinners", tag: "light" },
  { id: "quick-prep", label: "Quick sides and prep", tag: "quick" },
  { id: "batch", label: "Batch and freeze", tag: "batch" },
  { id: "recovery", label: "After training", tag: "recovery" },
  { id: "family-breakfast", label: "Family breakfast", tag: "breakfast" },
  { id: "try-new", label: "Something new to try", tag: "seasonal" },
];

export const PLANNER_EXAMPLES = [
  "More greens this week",
  "What do I do with a watermelon",
  "Lighter dinners for two",
  "A pepper base to batch",
];

// When someone asks for a whole cooked dish, point them at the produce part of it.
const REDIRECTS: { match: string[]; message: string }[] = [
  {
    match: ["jollof", "fried rice", "coconut rice", "ofada rice"],
    message:
      "We stick to fruit and vegetables, so we don't plan the whole rice dish. We can sort the pepper base and a vegetable side. Try “pepper base” or “garden salad”.",
  },
  {
    match: ["egusi", "ogbono", "efo riro", "edikang", "oha", "afang", "bitterleaf", "banga", "okra", "okro", "draw soup", "vegetable soup", "soup"],
    message:
      "We plan the produce, not the whole pot. We can handle your greens and pepper base. Try “greens for soup” or “pepper base”.",
  },
  {
    match: ["moi moi", "moimoi", "akara", "beans", "ewa", "gari", "eba", "amala", "fufu", "pounded yam", "semo", "swallow", "tuwo", "porridge", "pottage"],
    message:
      "That's outside fruit and veg. Tell us a fruit or a vegetable and we'll build around it, for example “roast vegetables” or “fruit plate”.",
  },
  {
    match: ["meat", "chicken", "fish", "beef", "goat", "turkey", "protein", "suya", "asun", "peppered"],
    message:
      "We're a produce shop, so no meat or fish here. We can plan the vegetables and sides to go with it. Try “roast vegetable tray” or “garden salad”.",
  },
];

// --- plan building ---------------------------------------------------------

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

export type PlanIdea = {
  slug: string;
  name: string;
  kind: IdeaKind;
  kindLabel: string;
  servings: number;
  timeMinutes: number;
  method: string;
  produce: PlanLine[];
  pantry: string[];
  produceTotal: number;
};

export type ProducePlan = {
  key: string;
  title: string;
  intro: string;
  ideas: PlanIdea[];
  combinedTotal: number;
};

export type PlanResponse = { plan: ProducePlan } | { redirect: string } | { plan: null };

function buildIdea(def: IdeaDef, servings: number, products: Map<string, Product>): PlanIdea {
  const scale = servings / def.baseServings;
  const lines: PlanLine[] = [];
  for (const pr of def.produce) {
    const product = products.get(pr.productSlug);
    if (!product) continue;
    const quantity = snapQty(
      Math.max(1, Math.round(pr.packs * scale)),
      product.minOrderQty,
      product.stepQty,
    );
    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unit: product.unit,
      imageEmoji: product.imageEmoji,
      cloudinaryPublicId: product.cloudinaryPublicId,
      quantity,
      lineCost: product.standardPrice * quantity,
    });
  }
  return {
    slug: def.slug,
    name: def.name,
    kind: def.kind,
    kindLabel: KIND_LABEL[def.kind],
    servings,
    timeMinutes: def.timeMinutes,
    method: def.method,
    produce: lines,
    pantry: def.pantry,
    produceTotal: lines.reduce((s, l) => s + l.lineCost, 0),
  };
}

function assemble(
  key: string,
  title: string,
  intro: string,
  defs: IdeaDef[],
  servings: number,
  productList: Product[],
): ProducePlan {
  const map = new Map(productList.map((p) => [p.slug, p]));
  const inStock = productList.filter((p) => p.inSeason);
  const inStockSlugs = new Set(inStock.map((p) => p.slug));

  const usable = defs.filter((d) => d.produce.some((pr) => inStockSlugs.has(pr.productSlug)));
  const ideas = usable.slice(0, 3).map((d) => buildIdea(d, servings, map));

  const seen = new Set<string>();
  const combinedTotal = ideas
    .flatMap((i) => i.produce)
    .filter((l) => (seen.has(l.productId) ? false : (seen.add(l.productId), true)))
    .reduce((s, l) => s + l.lineCost, 0);

  return { key, title, intro, ideas, combinedTotal };
}

// varied by kind so a plan isn't three salads
function pickVaried(defs: IdeaDef[]): IdeaDef[] {
  const byKind = new Map<IdeaKind, IdeaDef[]>();
  for (const d of defs) {
    const list = byKind.get(d.kind) ?? [];
    list.push(d);
    byKind.set(d.kind, list);
  }
  const out: IdeaDef[] = [];
  const kinds = [...byKind.keys()];
  let i = 0;
  while (out.length < defs.length && kinds.length) {
    const k = kinds[i % kinds.length];
    const list = byKind.get(k)!;
    const next = list.shift();
    if (next) out.push(next);
    if (list.length === 0) kinds.splice(i % kinds.length, 1);
    else i += 1;
  }
  return out;
}

export function planFromGoal(goalId: string, servings: number, products: Product[]): ProducePlan | null {
  const goal = PLANNER_GOALS.find((g) => g.id === goalId);
  if (!goal) return null;
  const matches = pickVaried(IDEAS.filter((d) => d.tags.includes(goal.tag)));
  const intros: Record<string, string> = {
    greens: "Three ways to get more leafy veg into the week.",
    fruit: "Fruit-forward ideas to keep on hand.",
    light: "Lighter plates that lean on vegetables.",
    quick: "Short on time. These come together fast.",
    batch: "Prep once, eat from it all week.",
    recovery: "What people usually reach for around training.",
    breakfast: "Simple fruit-and-veg starts for a table.",
    seasonal: "Whatever is at its best right now.",
  };
  return assemble(`goal:${goalId}`, goal.label, intros[goal.tag] ?? "A few produce ideas for your week.", matches, servings, products);
}

export function planThisWeek(servings: number, products: Product[]): ProducePlan {
  const seasonal = IDEAS.filter((d) => d.tags.includes("seasonal"));
  const rest = pickVaried(IDEAS.filter((d) => !d.tags.includes("seasonal")));
  return assemble(
    "week",
    "This week's picks",
    "A spread across a blend, something green, and a plate.",
    [...seasonal, ...rest],
    servings,
    products,
  );
}

export function planFromCartSlugs(
  slugs: string[],
  servings: number,
  products: Product[],
): ProducePlan | null {
  const set = new Set(slugs);
  const matched = IDEAS.map((d) => ({
    d,
    hits: d.produce.filter((pr) => set.has(pr.productSlug)).length,
  }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.d);
  if (matched.length === 0) return null;
  return assemble(
    "cart",
    "From your cart",
    "Ideas that lean on what you have already picked.",
    matched,
    servings,
    products,
  );
}

export function planFromIngredient(product: Product, servings: number, products: Product[]): ProducePlan {
  const featuring = IDEAS.filter((d) => d.produce.some((pr) => pr.productSlug === product.slug))
    // ideas where it appears earlier (more central) first
    .sort(
      (a, b) =>
        a.produce.findIndex((pr) => pr.productSlug === product.slug) -
        b.produce.findIndex((pr) => pr.productSlug === product.slug),
    );
  const list = featuring.length > 0 ? featuring : pickVaried(IDEAS);
  return assemble(
    `ingredient:${product.slug}`,
    `Ways to use ${product.name.toLowerCase()}`,
    featuring.length > 0
      ? `Ideas with ${product.name.toLowerCase()} doing the work.`
      : "We don't have a set idea for that one yet, so here is a spread for the week.",
    list,
    servings,
    products,
  );
}

function parseServings(text: string): number | null {
  const m =
    text.match(/\bfor\s+(\d{1,2})\b/) ??
    text.match(/\b(\d{1,2})\s*(?:people|persons?|pax|servings?|plates?)\b/) ??
    (/\bfor two\b/.test(text) ? ["", "2"] : null) ??
    (/\bfor the family\b/.test(text) ? ["", "4"] : null);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 20 ? n : null;
}

// Specific phrases that mean "give me the multi-idea plan for this goal".
const GOAL_PHRASES: { phrases: string[]; goalId: string }[] = [
  { phrases: ["more greens", "more green", "more leafy", "eat more veg", "more vegetable"], goalId: "more-greens" },
  { phrases: ["more fruit", "fruit through the week", "fruit for the week", "eat more fruit"], goalId: "more-fruit" },
  { phrases: ["lighter dinner", "lighter meal", "light dinner", "light meal", "eat lighter", "lighter meals"], goalId: "lighter-meals" },
  { phrases: ["quick side", "quick prep", "something quick", "quick meals", "fast dinner", "weeknight"], goalId: "quick-prep" },
  { phrases: ["batch and freeze", "cook ahead", "cook-ahead", "meal prep", "prep for the week", "batch"], goalId: "batch" },
  { phrases: ["after training", "after a workout", "post workout", "post-workout", "after the gym"], goalId: "recovery" },
  { phrases: ["family breakfast", "breakfast for the family", "kids breakfast", "breakfast for a family"], goalId: "family-breakfast" },
  { phrases: ["something new", "try something new", "whats in season", "what is in season"], goalId: "try-new" },
];

const GOAL_KEYWORDS: { words: string[]; goalId: string }[] = [
  { words: ["green", "greens", "leafy", "ugu", "spinach", "vegetable"], goalId: "more-greens" },
  { words: ["fruit", "fruits", "smoothie", "juice", "blend"], goalId: "more-fruit" },
  { words: ["light", "lighter", "salad", "low calorie", "weight"], goalId: "lighter-meals" },
  { words: ["quick", "fast", "easy", "10 min", "20 min", "weeknight"], goalId: "quick-prep" },
  { words: ["batch", "freeze", "prep", "meal prep", "cook ahead", "ahead"], goalId: "batch" },
  { words: ["workout", "gym", "training", "recovery", "protein shake"], goalId: "recovery" },
  { words: ["breakfast", "morning"], goalId: "family-breakfast" },
  { words: ["season", "seasonal", "new", "try"], goalId: "try-new" },
];

export function planFromText(text: string, products: Product[]): PlanResponse {
  const t = text.toLowerCase().trim();
  if (!t) return { plan: null };
  const servings = parseServings(t) ?? 3;

  // A goal phrase gets the multi-idea plan for the week
  const goalPhrase = GOAL_PHRASES.find((g) => g.phrases.some((p) => t.includes(p)));
  if (goalPhrase) {
    const plan = planFromGoal(goalPhrase.goalId, servings, products);
    if (plan) return { plan };
  }

  // A direct idea match ("garden salad", "greens for soup", "pepper base")
  const idea = IDEAS.find((d) => d.aliases.some((a) => t.includes(a)));
  if (idea) {
    const map = new Map(products.map((p) => [p.slug, p]));
    const built = buildIdea(idea, servings, map);
    return {
      plan: {
        key: `idea:${idea.slug}`,
        title: idea.name,
        intro: "A single idea to build your list around.",
        ideas: [built],
        combinedTotal: built.produceTotal,
      },
    };
  }

  // Then redirect whole cooked dishes to their produce part
  for (const r of REDIRECTS) {
    if (r.match.some((m) => t.includes(m))) return { redirect: r.message };
  }

  // An ingredient
  const ingredient = products.find(
    (p) => t.includes(p.name.toLowerCase()) || t.includes(p.slug.replace(/-/g, " ")),
  );
  if (ingredient) return { plan: planFromIngredient(ingredient, servings, products) };

  // A goal keyword
  const goalHit = GOAL_KEYWORDS.find((g) => g.words.some((w) => t.includes(w)));
  if (goalHit) return { plan: planFromGoal(goalHit.goalId, servings, products)! };

  return { plan: null };
}
