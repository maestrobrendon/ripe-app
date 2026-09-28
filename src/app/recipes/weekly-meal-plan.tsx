"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { MEAL_PLAN_DAYS, type MealPlanDay, type MealPlanDayEntry } from "@/lib/meal-plan-types";
import {
  swapMealPlanDay,
  setMealPlanDayStatus,
  sendDayIngredientsToBasket,
  sendWeekMissingToBasket,
  sendWeekMissingToCart,
} from "./meal-plan-actions";

const DAY_LABEL: Record<MealPlanDay, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

export type MealPlanRecipeInfo = { title: string; ingredientCount: number; missingCount: number };

function DayCard({
  entry,
  recipe,
  interactive,
  weekOffset,
}: {
  entry: MealPlanDayEntry;
  recipe: MealPlanRecipeInfo | null;
  interactive: boolean;
  weekOffset: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const skipped = entry.status === "SKIPPED";
  const cooked = entry.status === "COOKED";

  return (
    <div
      className={`rounded-card border p-4 ${
        skipped ? "border-dashed border-border bg-soft-mist" : "border-border bg-surface"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{DAY_LABEL[entry.day]}</p>
      <p className="mt-1 font-semibold">{skipped ? "Skipped" : recipe?.title ?? "No idea picked yet"}</p>
      {recipe && !skipped && (
        <p className="mt-1 text-xs text-muted">
          {recipe.ingredientCount} ingredients
          {recipe.missingCount > 0 && `, ${recipe.missingCount} to add`}
        </p>
      )}

      {interactive && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => swapMealPlanDay(weekOffset, entry.day))}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-sky-wash disabled:opacity-50"
          >
            Swap
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => setMealPlanDayStatus(weekOffset, entry.day, skipped ? "PLANNED" : "SKIPPED"))}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-sky-wash disabled:opacity-50"
          >
            {skipped ? "Unskip" : "Skip"}
          </button>
          {!skipped && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => setMealPlanDayStatus(weekOffset, entry.day, cooked ? "PLANNED" : "COOKED"))}
              className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                cooked ? "border-carbon bg-carbon text-white" : "border-border hover:bg-sky-wash"
              }`}
            >
              {cooked ? "Cooked" : "Mark cooked"}
            </button>
          )}
          {!skipped && recipe && recipe.missingCount > 0 && (
            <button
              type="button"
              disabled={isPending || sent}
              onClick={() =>
                startTransition(async () => {
                  await sendDayIngredientsToBasket(weekOffset, entry.day);
                  setSent(true);
                })
              }
              className="rounded-full bg-carbon px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {sent ? "Sent" : "Send missing to basket"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function WeeklyMealPlanBuilder({
  locked,
  days,
  recipes,
  shipDayLabel,
  weekOffset = 0,
  weekLabel,
}: {
  locked: boolean;
  days: MealPlanDayEntry[];
  recipes: Record<string, MealPlanRecipeInfo>;
  /** The active basket's ship day, shown on the calendar so the plan and the
   * delivery it draws from stay visibly lined up (Section 2b). Subscribers only. */
  shipDayLabel?: string | null;
  /** Weeks from the current one; 0 is this week. Locked previews never navigate. */
  weekOffset?: number;
  /** e.g. "Sep 29 – Oct 5" — display only, computed server-side. */
  weekLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [weekSent, setWeekSent] = useState<"basket" | "cart" | null>(null);
  const anyMissing = days.some(
    (d) => d.status !== "SKIPPED" && d.recipeId && (recipes[d.recipeId]?.missingCount ?? 0) > 0,
  );

  return (
    <div className="rounded-card-lg border border-border bg-surface p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-heading">Weekly meal plan</h3>
          <p className="mt-1 text-muted">
            {locked
              ? "A full week planned out, editable day by day. Subscribe to unlock it."
              : "Edit any day, and send what's missing straight to your basket."}
          </p>
          {!locked && shipDayLabel && (
            <p className="mt-2 text-sm font-medium text-carbon">
              Your basket ships {shipDayLabel.slice(0, 1) + shipDayLabel.slice(1).toLowerCase()}
            </p>
          )}
        </div>
        {!locked && anyMissing && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await sendWeekMissingToCart(weekOffset);
                  setWeekSent("cart");
                })
              }
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-sky-wash disabled:opacity-50"
            >
              {weekSent === "cart" ? "Sent to cart" : "Send week's gaps to Cart"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await sendWeekMissingToBasket(weekOffset);
                  setWeekSent("basket");
                })
              }
              className="rounded-full bg-carbon px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {weekSent === "basket" ? "Added to basket" : "Add week's gaps to Basket"}
            </button>
          </div>
        )}
      </div>

      {!locked && (
        <div className="mt-5 flex items-center justify-center gap-4 border-t border-border pt-5">
          <Link
            href={`/recipes?tab=planner&week=${weekOffset - 1}`}
            aria-label="Previous week"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-sky-wash"
          >
            <Icon name="minus" size={14} />
          </Link>
          <p className="text-sm font-semibold">
            {weekOffset === 0 ? "This week" : weekLabel ?? (weekOffset > 0 ? `${weekOffset} weeks ahead` : `${-weekOffset} weeks ago`)}
          </p>
          <Link
            href={`/recipes?tab=planner&week=${weekOffset + 1}`}
            aria-label="Next week"
            className="tap-target flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-sky-wash"
          >
            <Icon name="plus" size={14} />
          </Link>
        </div>
      )}

      <div className="relative mt-6">
        <div className={`grid gap-3 sm:grid-cols-3 lg:grid-cols-7 ${locked ? "pointer-events-none select-none opacity-40" : ""}`}>
          {MEAL_PLAN_DAYS.map((day) => {
            const entry = days.find((d) => d.day === day) ?? {
              day,
              recipeId: null,
              suggestion: null,
              status: "PLANNED" as const,
            };
            return (
              <DayCard
                key={day}
                entry={entry}
                recipe={entry.recipeId ? recipes[entry.recipeId] ?? null : null}
                interactive={!locked}
                weekOffset={weekOffset}
              />
            );
          })}
        </div>

        {locked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface/95 px-6 py-5 text-center shadow-sm">
              <Icon name="reward" size={22} className="text-carbon" />
              <p className="max-w-xs text-sm text-muted">
                Subscribe to unlock a real weekly plan that persists and edits day to day.
              </p>
              <Link
                href="/subscribe"
                className="tap-target rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white hover:bg-carbon/85"
              >
                Subscribe to unlock
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
