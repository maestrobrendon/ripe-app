import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { MENU_GOALS, type Amount, type MenuDetail, type MenuGoal, type MenuRecipe } from "@/lib/menu-types";
import type { Recipe } from "@/generated/prisma/client";

/*
 * The menu, from the Recipe table: published recipes marked onMenu, in their
 * set order. One query per request (React cache), shared by every page,
 * action and Kachi call that needs it. Client components get the result as
 * props or through the home page's MenuProvider.
 */

const GOALS = new Set<string>(MENU_GOALS.map((g) => g.id));

export function toMenuRecipe(r: Recipe): MenuRecipe {
  return {
    slug: r.slug,
    title: r.title,
    hook: r.summary,
    goal: (GOALS.has(r.goal ?? "") ? r.goal : "busy") as MenuGoal,
    minutes: r.minutes ?? 0,
    serves: r.serves ?? 2,
    image: r.image ?? "",
    alt: r.imageAlt ?? r.title,
    basket: r.basketSlugs,
    elsewhere: r.elsewhere,
    steps: r.steps,
    membersOnly: r.membersOnly,
  };
}

export function toMenuDetail(r: Pick<Recipe, "amounts" | "tools">): MenuDetail {
  const amounts: Record<string, Amount> = {};
  if (r.amounts && typeof r.amounts === "object" && !Array.isArray(r.amounts)) {
    for (const [k, v] of Object.entries(r.amounts as Record<string, unknown>)) {
      if (Array.isArray(v) && typeof v[0] === "number" && typeof v[1] === "string") amounts[k] = [v[0], v[1]];
    }
  }
  return { amounts, tools: r.tools };
}

const menuRows = cache(() =>
  prisma.recipe.findMany({ where: { onMenu: true, status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
);

/** The published menu, in order. */
export const getMenu = cache(async (): Promise<MenuRecipe[]> => (await menuRows()).map(toMenuRecipe));

/**
 * The menu for pages a guest can see (the homepage, sign-up): a members-only
 * recipe's method is left out, so it never reaches the page's data.
 */
export const getGuestMenu = cache(async (): Promise<MenuRecipe[]> => (await getMenu()).map((r) => (r.membersOnly ? { ...r, steps: [] } : r)));

/** Every catalogue slug the menu uses, for one product query. */
export const getMenuSlugs = cache(async (): Promise<string[]> => [...new Set((await getMenu()).flatMap((r) => r.basket))]);

/** A published recipe by slug, with its row (for amounts, tools and member gating). */
export const getRecipeRow = cache((slug: string) => prisma.recipe.findFirst({ where: { slug, status: "PUBLISHED" } }));
