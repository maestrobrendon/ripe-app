// Server-only: pulls in Prisma. Client components must import types and
// constants from @/lib/meal-plan-types instead (see that file's header for
// why the split exists — it's a hard requirement, not a style preference).
import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { MEAL_PLAN_DAYS, parseDays, type MealPlanDay, type MealPlanDayEntry } from "@/lib/meal-plan-types";

export { MEAL_PLAN_DAYS, MEAL_SLOTS, MEAL_SLOT_LABEL, parseDays, parseElsewhereGot } from "@/lib/meal-plan-types";
export type { MealPlanDay, MealPlanDayEntry, MealSlotKey, MealRef } from "@/lib/meal-plan-types";

/** The Monday (UTC) of the current week, used as the plan's stable key. */
export function currentWeekStart(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 1 (Mon) .. 7 (Sun)
  d.setUTCDate(d.getUTCDate() - (isoDay - 1));
  return d;
}

/** The Monday `offset` weeks from the current one — negative for past weeks. */
export function weekStartWithOffset(offset: number): Date {
  const d = currentWeekStart();
  d.setUTCDate(d.getUTCDate() + offset * 7);
  return d;
}

function pickRecipeFor(day: MealPlanDay, pool: { id: string }[]): string | null {
  if (pool.length === 0) return null;
  const index = MEAL_PLAN_DAYS.indexOf(day) % pool.length;
  return pool[index].id;
}

async function candidateRecipes(primaryGoal: string | null | undefined) {
  const goalMatched = primaryGoal
    ? await prisma.recipe.findMany({ where: { goalTags: { has: primaryGoal } } })
    : [];
  if (goalMatched.length > 0) return goalMatched;
  return prisma.recipe.findMany({ take: 20 });
}

/**
 * Subscriber-only: a free account never gets a real row here (Section 1 of
 * the Recipes-by-tier addendum defaults to no free preview), so this always
 * creates the plan under a subscriber's own account the first time they load
 * the builder for a given week. Defaults to the current week; the Meal
 * Planner's week-strip navigation passes an explicit one.
 *
 * When the account has "use this timetable every week" on, a new week clones
 * the most recent prior week's timetable (same recipes/own meals in the same
 * slots) instead of picking fresh suggestions — that's the whole feature.
 */
export async function getOrCreateWeeklyPlan(user: CurrentUser, weekStartDate: Date = currentWeekStart()) {
  const existing = await prisma.weeklyMealPlan.findUnique({
    where: { userId_weekStartDate: { userId: user.id, weekStartDate } },
  });
  if (existing) return existing;

  if (user.mealPlanRepeats) {
    const previous = await prisma.weeklyMealPlan.findFirst({
      where: { userId: user.id, weekStartDate: { lt: weekStartDate } },
      orderBy: { weekStartDate: "desc" },
    });
    if (previous) {
      const days = parseDays(previous.days).map((d) => ({ ...d, status: "PLANNED" as const }));
      return prisma.weeklyMealPlan.create({
        data: { userId: user.id, weekStartDate, days: days as object as never },
      });
    }
  }

  const pool = await candidateRecipes(user.preferences?.primaryGoal);
  const days: MealPlanDayEntry[] = MEAL_PLAN_DAYS.map((day) => {
    const recipeId = pickRecipeFor(day, pool);
    return {
      day,
      slots: { breakfast: null, lunch: null, dinner: recipeId ? { kind: "recipe", recipeId } : null },
      status: "PLANNED",
    };
  });

  return prisma.weeklyMealPlan.create({
    data: { userId: user.id, weekStartDate, days: days as object as never },
  });
}
