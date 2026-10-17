// Pure types and constants only, no server-only imports — this is safe to
// import from client components. src/lib/weekly-meal-plan.ts holds the
// Prisma-backed logic and must only ever be imported from server code.
import type { MealPlanDayStatus } from "@/generated/prisma/enums";

export const MEAL_PLAN_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type MealPlanDay = (typeof MEAL_PLAN_DAYS)[number];

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type MealSlotKey = (typeof MEAL_SLOTS)[number];

export const MEAL_SLOT_LABEL: Record<MealSlotKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export type MealRef = { kind: "recipe"; recipeId: string } | { kind: "own"; ownMealId: string };

export type MealPlanDayEntry = {
  day: MealPlanDay;
  slots: Record<MealSlotKey, MealRef | null>;
  status: MealPlanDayStatus;
};

function emptySlots(): Record<MealSlotKey, MealRef | null> {
  return { breakfast: null, lunch: null, dinner: null };
}

/**
 * Tolerant of the old one-recipe-per-day shape ({ recipeId, suggestion })
 * still sitting in any row created before slots existed: it becomes that
 * day's dinner, nothing is lost, and every row reads uniformly from here on.
 */
function normalizeEntry(raw: unknown, day: MealPlanDay): MealPlanDayEntry {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.slots && typeof r.slots === "object") {
    const slots = r.slots as Record<string, MealRef | null>;
    return {
      day,
      slots: {
        breakfast: slots.breakfast ?? null,
        lunch: slots.lunch ?? null,
        dinner: slots.dinner ?? null,
      },
      status: (r.status as MealPlanDayStatus) ?? "PLANNED",
    };
  }
  const legacyRecipeId = typeof r.recipeId === "string" ? r.recipeId : null;
  return {
    day,
    slots: { ...emptySlots(), dinner: legacyRecipeId ? { kind: "recipe", recipeId: legacyRecipeId } : null },
    status: (r.status as MealPlanDayStatus) ?? "PLANNED",
  };
}

export function parseDays(days: unknown): MealPlanDayEntry[] {
  if (!Array.isArray(days)) return MEAL_PLAN_DAYS.map((day) => ({ day, slots: emptySlots(), status: "PLANNED" }));
  return MEAL_PLAN_DAYS.map((day, i) => normalizeEntry(days[i], day));
}

export function parseElsewhereGot(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
}
