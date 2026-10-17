import type { Recipe } from "@/generated/prisma/client";
import { toMenuDetail } from "@/lib/menu";
import type { RecipeInput } from "./actions";

/* The editor's working copy of a recipe. Shared by the editor (client) and its pages (server). */

export type RecipeDraft = Required<{ [K in keyof RecipeInput]: Exclude<RecipeInput[K], undefined> }>;

export const EMPTY_RECIPE: RecipeDraft = {
  title: "",
  slug: "",
  summary: "",
  goal: "lighter",
  minutes: 20,
  serves: 2,
  image: null,
  imageAlt: null,
  basket: [],
  elsewhere: [],
  steps: [""],
  tools: [],
};

/** A row as a draft. Older library recipes have product ids, not slugs: map them across. */
export function toDraft(r: Recipe, slugById: Map<string, string>): RecipeDraft {
  const { amounts, tools } = toMenuDetail(r);
  const basketSlugs = r.basketSlugs.length ? r.basketSlugs : r.ingredientProductIds.map((id) => slugById.get(id)).filter((s): s is string => Boolean(s));
  const steps = r.steps.length ? r.steps : r.instructions.split("\n").map((s) => s.trim()).filter(Boolean);
  return {
    title: r.title,
    slug: r.slug,
    summary: r.summary,
    goal: r.goal ?? "lighter",
    minutes: r.minutes ?? 20,
    serves: r.serves ?? 2,
    image: r.image,
    imageAlt: r.imageAlt,
    basket: basketSlugs.map((slug) => ({ slug, amount: amounts[slug] ? [amounts[slug][0], amounts[slug][1]] : null })),
    elsewhere: r.elsewhere.map((label) => ({ label, amount: amounts[label] ? [amounts[label][0], amounts[label][1]] : null })),
    steps: steps.length ? steps : [""],
    tools,
  };
}
