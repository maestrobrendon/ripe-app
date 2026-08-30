import { getBasketSuggestions, getGoalSuggestions, type AssistantContext } from "@/lib/assistant";
import type { Product, Recipe, ProductCategory } from "@/generated/prisma/client";

export type HubSuggestion = {
  recipe: { slug: string; title: string; addNames: string[] } | null;
  add: { id: string; name: string; imageEmoji: string; reason: string } | null;
  gap: { message: string; fixId: string | null; fixName: string | null; fixEmoji: string | null } | null;
};

type BasketItem = { slug: string; category: ProductCategory; inSeason: boolean; name: string };

const FRUITY: ProductCategory[] = ["FRUIT", "SEASONAL"];

export function buildHubSuggestion({
  basket,
  goal,
  context,
  products,
  recipes,
}: {
  basket: BasketItem[];
  goal: string | null;
  context: AssistantContext;
  products: Product[];
  recipes: Recipe[];
}): HubSuggestion {
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const byId = new Map(products.map((p) => [p.id, p]));
  const basketSlugs = new Set(basket.map((b) => b.slug));
  const basketCats = new Set(basket.map((b) => b.category));

  // ---- recipe --------------------------------------------------------------
  let recipe: HubSuggestion["recipe"] = null;
  {
    const scored = recipes
      .map((r) => {
        const ingredientSlugs = r.ingredientProductIds
          .map((id) => byId.get(id)?.slug)
          .filter((s): s is string => Boolean(s));
        const have = ingredientSlugs.filter((s) => basketSlugs.has(s)).length;
        const missing = ingredientSlugs.filter((s) => !basketSlugs.has(s));
        const goalMatch = goal && r.goalTags.includes(goal) ? 1 : 0;
        return { r, score: have + goalMatch, have, missing };
      })
      .sort((a, b) => b.score - a.score);

    const pick =
      scored.find((s) => s.have >= 1 && s.missing.length > 0) ??
      scored.find((s) => s.missing.length > 0) ??
      null;

    if (pick) {
      const addSlugs = pick.missing.slice(0, 3);
      recipe = {
        slug: pick.r.slug,
        title: pick.r.title,
        addNames: addSlugs.map((s) => bySlug.get(s)?.name ?? s),
      };
    }
  }

  // ---- one suggested add --------------------------------------------------
  let add: HubSuggestion["add"] = null;
  {
    const pairing = getBasketSuggestions([...basketSlugs], context).addOns.find(
      (s) => !basketSlugs.has(s) && bySlug.has(s),
    );
    const goalAdd = goal
      ? getGoalSuggestions(goal, context)?.addOns.find(
          (s) => !basketSlugs.has(s) && bySlug.has(s),
        )
      : undefined;
    const fallback = products.find(
      (p) => p.featured && p.inSeason && !basketSlugs.has(p.slug),
    )?.slug;

    const chosen = pairing ?? goalAdd ?? fallback;
    if (chosen) {
      const p = bySlug.get(chosen)!;
      add = {
        id: p.id,
        name: p.name,
        imageEmoji: p.imageEmoji,
        reason: pairing
          ? "pairs with your basket"
          : goalAdd
          ? "fits your goal"
          : "in season now",
      };
    }
  }

  // ---- one gap flag -----------------------------------------------------
  let gap: HubSuggestion["gap"] = null;
  {
    const outOfSeason = basket.find((b) => !b.inSeason);
    const hasFruit = [...basketCats].some((c) => FRUITY.includes(c) || c === "BOX_BUNDLE");
    const hasVeg = basketCats.has("VEGETABLE") || basketCats.has("BOX_BUNDLE");

    const fixOf = (p: Product | undefined) => ({
      fixId: p?.id ?? null,
      fixName: p?.name ?? null,
      fixEmoji: p?.imageEmoji ?? null,
    });
    const inSeasonFix = (cat: ProductCategory) =>
      products.find((p) => p.category === cat && p.inSeason && !basketSlugs.has(p.slug));

    if (outOfSeason) {
      const fix = products.find(
        (p) =>
          p.category === bySlug.get(outOfSeason.slug)?.category &&
          p.inSeason &&
          !basketSlugs.has(p.slug),
      );
      gap = { message: `${outOfSeason.name} is out of season this week`, ...fixOf(fix) };
    } else if (!hasFruit) {
      gap = { message: "No fruit in your basket yet", ...fixOf(inSeasonFix("FRUIT")) };
    } else if (!hasVeg) {
      gap = { message: "No vegetables in your basket yet", ...fixOf(inSeasonFix("VEGETABLE")) };
    }
  }

  return { recipe, add, gap };
}
