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

export type MealPlanDayEntry = {
  day: MealPlanDay;
  recipeId: string | null;
  suggestion: { title: string; ingredientProductIds: string[] } | null;
  status: MealPlanDayStatus;
};

export function parseDays(days: unknown): MealPlanDayEntry[] {
  if (!Array.isArray(days)) return [];
  return days as MealPlanDayEntry[];
}
