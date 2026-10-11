import "server-only";
import { prisma } from "@/lib/prisma";
import { GOAL_LABEL } from "@/lib/format";
import { MENU, MENU_GOALS, MENU_SLUGS, type MenuGoal, type MenuRecipe } from "@/app/(bare)/home-menu/recipes";
import { MENU_DETAILS, type Amount } from "./menu-details";

/**
 * One shape for the recipe page, whichever source the recipe comes from:
 * the photographed menu (MENU, what the homepage and sign-up use) or the
 * older Recipe table (the library the meal plan and saves point at). The
 * page reads only this, so the two can merge later without touching it.
 */

export type RecipeProduct = {
  id: string;
  slug: string;
  name: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  /** What this viewer pays per minimum order: member price for subscribers. */
  price: number;
  minOrderQty: number;
  unit: string;
};

export type BasketIngredient = { product: RecipeProduct; amount: Amount | null; have: boolean };
export type ElsewhereIngredient = { label: string; amount: Amount | null };

export type RecipeView = {
  source: "menu" | "library";
  /** The Recipe row's id, for saving. Menu recipes have none yet. */
  recipeId: string | null;
  slug: string;
  title: string;
  hook: string;
  goal: MenuGoal | null;
  /** Labels for the chips under the title. */
  tags: string[];
  minutes: number | null;
  serves: number | null;
  image: string | null;
  alt: string;
  basket: BasketIngredient[];
  elsewhere: ElsewhereIngredient[];
  steps: string[];
  tools: string[];
};

export type RecipeCardView = {
  slug: string;
  title: string;
  hook: string;
  goal: MenuGoal;
  goalLabel: string;
  minutes: number;
  serves: number;
  image: string;
  alt: string;
  fromBasket: number;
  total: number;
};

type Viewer = { isSubscriber: boolean; basketProductIds?: Set<string> };

const GOAL_FROM_TAG = new Map(MENU_GOALS.map((g) => [g.starterSlug, g.id]));
export const MENU_GOAL_LABEL = Object.fromEntries(MENU_GOALS.map((g) => [g.id, g.label])) as Record<MenuGoal, string>;

const toProduct = (
  p: { id: string; slug: string; name: string; imageEmoji: string; cloudinaryPublicId: string | null; memberPrice: number; standardPrice: number; minOrderQty: number; unit: string },
  isSubscriber: boolean,
): RecipeProduct => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  imageEmoji: p.imageEmoji,
  cloudinaryPublicId: p.cloudinaryPublicId,
  price: (isSubscriber ? p.memberPrice : p.standardPrice) * p.minOrderQty,
  minOrderQty: p.minOrderQty,
  unit: p.unit,
});

/** A slug the catalogue no longer has is still an ingredient: it reads as "elsewhere". */
const slugLabel = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ");

/** The menu as cards, with how much of each recipe Basket covers. */
export async function getMenuCards(): Promise<RecipeCardView[]> {
  const stocked = new Set(
    (await prisma.product.findMany({ where: { slug: { in: MENU_SLUGS } }, select: { slug: true } })).map((p) => p.slug),
  );
  return MENU.map((r) => toCard(r, stocked));
}

function toCard(r: MenuRecipe, stocked: Set<string>): RecipeCardView {
  const fromBasket = r.basket.filter((s) => stocked.has(s)).length;
  return {
    slug: r.slug,
    title: r.title,
    hook: r.hook,
    goal: r.goal,
    goalLabel: MENU_GOAL_LABEL[r.goal],
    minutes: r.minutes,
    serves: r.serves,
    image: r.image,
    alt: r.alt,
    fromBasket,
    total: r.basket.length + r.elsewhere.length,
  };
}

export async function getRecipeView(slug: string, viewer: Viewer): Promise<RecipeView | null> {
  const has = (id: string) => Boolean(viewer.isSubscriber && viewer.basketProductIds?.has(id));
  const menu = MENU.find((r) => r.slug === slug);

  if (menu) {
    const detail = MENU_DETAILS[menu.slug];
    const products = await prisma.product.findMany({ where: { slug: { in: menu.basket } } });
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const basket: BasketIngredient[] = [];
    const missing: string[] = [];
    for (const s of menu.basket) {
      const p = bySlug.get(s);
      if (p) basket.push({ product: toProduct(p, viewer.isSubscriber), amount: detail?.amounts[s] ?? null, have: has(p.id) });
      else missing.push(s);
    }
    return {
      source: "menu",
      recipeId: null,
      slug: menu.slug,
      title: menu.title,
      hook: menu.hook,
      goal: menu.goal,
      tags: [MENU_GOAL_LABEL[menu.goal]],
      minutes: menu.minutes,
      serves: menu.serves,
      image: menu.image,
      alt: menu.alt,
      basket,
      elsewhere: [
        ...missing.map((s) => ({ label: slugLabel(s), amount: detail?.amounts[s] ?? null })),
        ...menu.elsewhere.map((e) => ({ label: e, amount: detail?.amounts[e] ?? null })),
      ],
      steps: menu.steps,
      tools: detail?.tools ?? [],
    };
  }

  const recipe = await prisma.recipe.findUnique({ where: { slug } });
  if (!recipe) return null;
  const products = await prisma.product.findMany({ where: { id: { in: recipe.ingredientProductIds } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    source: "library",
    recipeId: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    hook: recipe.summary,
    goal: recipe.goalTags.map((t) => GOAL_FROM_TAG.get(t)).find(Boolean) ?? null,
    tags: recipe.goalTags.map((t) => GOAL_LABEL[t] ?? t),
    minutes: null,
    serves: null,
    image: null,
    alt: "",
    basket: recipe.ingredientProductIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ product: toProduct(p, viewer.isSubscriber), amount: null, have: has(p.id) })),
    elsewhere: [],
    steps: recipe.instructions.split("\n").map((s) => s.trim()).filter(Boolean),
    tools: [],
  };
}

/** Three more to cook: the same goal first, then whatever is quickest. */
export async function getRelatedCards(slug: string, goal: MenuGoal | null): Promise<RecipeCardView[]> {
  const cards = (await getMenuCards()).filter((c) => c.slug !== slug);
  const same = cards.filter((c) => c.goal === goal);
  const rest = cards.filter((c) => c.goal !== goal).sort((a, b) => a.minutes - b.minutes);
  return [...same, ...rest].slice(0, 3);
}
