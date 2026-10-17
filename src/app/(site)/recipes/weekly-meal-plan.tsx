"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  MEAL_PLAN_DAYS,
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  type MealPlanDay,
  type MealSlotKey,
} from "@/lib/meal-plan-types";
import type { MealPlanDayStatus, ShoppingWindowDay } from "@/generated/prisma/enums";
import {
  setMealSlot,
  setMealPlanDayStatus,
  setMealPlanRepeats,
  sendDayIngredientsToBasket,
  sendWeekMissingToBasket,
  sendWeekMissingToCart,
} from "./meal-plan-actions";
import { getRecipeDetail } from "./recipe-detail-action";
import { RecipeSheet, type RecipeSheetData } from "./recipe-sheet";
import { AddMealSheet, MealMenuSheet } from "./meal-slot-sheets";
import { ShoppingListSheet } from "./shopping-list-sheet";

export type SlotView =
  | { kind: "recipe"; refId: string; title: string; ingredientCount: number }
  | { kind: "own"; refId: string; title: string; ingredientLines: { label: string; weSell: boolean }[] };

export type DayView = {
  day: MealPlanDay;
  status: MealPlanDayStatus;
  slots: Record<MealSlotKey, SlotView | null>;
};

export type MealOption = { id: string; name: string; ingredientCount: number };
export type RecipeOption = { id: string; title: string; ingredientCount: number };

const DAY_SHORT: Record<MealPlanDay, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};
const DAY_FULL: Record<MealPlanDay, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

function todayAsPlanDay(): MealPlanDay {
  const idx = (new Date().getDay() + 6) % 7; // 0 (Mon) .. 6 (Sun)
  return MEAL_PLAN_DAYS[idx];
}

export function WeeklyMealPlanBuilder({
  weekOffset = 0,
  weekLabel,
  days,
  basketShipDay,
  repeatsEnabled,
  ownMealOptions,
  recipeOptions,
}: {
  weekOffset?: number;
  weekLabel?: string;
  days: DayView[];
  /** The active basket's ship day, so the timetable and the delivery it draws from stay visibly lined up. */
  basketShipDay?: ShoppingWindowDay | null;
  repeatsEnabled: boolean;
  ownMealOptions: MealOption[];
  recipeOptions: RecipeOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<"day" | "week">("day");
  const [selectedDay, setSelectedDay] = useState<MealPlanDay>(todayAsPlanDay());
  const [addTarget, setAddTarget] = useState<{ day: MealPlanDay; slot: MealSlotKey } | null>(null);
  const [menuTarget, setMenuTarget] = useState<{ day: MealPlanDay; slot: MealSlotKey } | null>(null);
  const [recipeSheet, setRecipeSheet] = useState<RecipeSheetData | null>(null);
  const [shoppingListOpen, setShoppingListOpen] = useState(false);
  const [weekSent, setWeekSent] = useState<"basket" | "cart" | null>(null);

  const dayView = (day: MealPlanDay) => days.find((d) => d.day === day) ?? { day, status: "PLANNED" as const, slots: { breakfast: null, lunch: null, dinner: null } };
  const current = dayView(selectedDay);
  const anyFilled = days.some((d) => MEAL_SLOTS.some((s) => d.slots[s]));

  const openRecipe = (recipeId: string) =>
    startTransition(async () => {
      const data = await getRecipeDetail(recipeId);
      if (data) setRecipeSheet(data);
    });

  const clearSlot = (day: MealPlanDay, slot: MealSlotKey) =>
    startTransition(async () => {
      await setMealSlot(weekOffset, day, slot, null);
      setMenuTarget(null);
      router.refresh();
    });

  const toggleRepeat = () =>
    startTransition(async () => {
      await setMealPlanRepeats(!repeatsEnabled);
      router.refresh();
    });

  const menuSlot = menuTarget ? dayView(menuTarget.day).slots[menuTarget.slot] : null;

  return (
    <div className="rounded-card-lg border border-border bg-surface p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-heading">Food timetable</h3>
          <p className="mt-1 text-muted">Plan what you eat this week. Add your own meals or ours.</p>
          {basketShipDay && (
            <p className="mt-2 text-sm font-medium text-carbon">
              Your basket ships {basketShipDay.slice(0, 1) + basketShipDay.slice(1).toLowerCase()}
            </p>
          )}
        </div>
        <div className="flex overflow-hidden rounded-full bg-soft-mist p-1">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${
                view === v ? "bg-surface shadow-sm" : "text-muted"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button
          onClick={() => setShoppingListOpen(true)}
          className="tap-target inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-sky-wash"
        >
          <Icon name="cart" size={14} />
          Shopping list
        </button>
        {anyFilled && (
          <>
            <button
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
          </>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
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

      {view === "day" ? (
        <>
          <div className="mt-6 grid grid-cols-7 gap-1.5">
            {MEAL_PLAN_DAYS.map((day) => {
              const dv = dayView(day);
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  aria-pressed={day === selectedDay}
                  className={`flex flex-col items-center gap-1.5 rounded-input py-2.5 ${
                    day === selectedDay ? "bg-carbon text-white" : "hover:bg-sky-wash"
                  }`}
                >
                  <span className="text-[11px]">{DAY_SHORT[day]}</span>
                  <span className="flex gap-0.5">
                    {MEAL_SLOTS.map((s) => (
                      <i
                        key={s}
                        className={`block h-1 w-1 rounded-full ${
                          dv.slots[s] ? (day === selectedDay ? "bg-white" : "bg-carbon") : "bg-border"
                        }`}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold">
                {DAY_FULL[selectedDay]}
                {selectedDay === todayAsPlanDay() && weekOffset === 0 ? ", today" : ""}
              </h4>
              {basketShipDay === selectedDay && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-pop/25 px-2.5 py-1 text-xs font-semibold text-carbon">
                  <Icon name="delivery" size={12} />
                  Your basket arrives today
                </span>
              )}
              <button
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setMealPlanDayStatus(
                      weekOffset,
                      selectedDay,
                      current.status === "SKIPPED" ? "PLANNED" : "SKIPPED",
                    );
                    router.refresh();
                  })
                }
                className="ml-auto rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-sky-wash disabled:opacity-50"
              >
                {current.status === "SKIPPED" ? "Unskip day" : "Skip day"}
              </button>
            </div>

            <div className={`mt-3 space-y-2 ${current.status === "SKIPPED" ? "opacity-40" : ""}`}>
              {MEAL_SLOTS.map((slot) => {
                const filled = current.slots[slot];
                return (
                  <div key={slot}>
                    <p className="mb-1 text-xs font-medium text-muted">{MEAL_SLOT_LABEL[slot]}</p>
                    {filled ? (
                      <button
                        disabled={current.status === "SKIPPED"}
                        onClick={() => setMenuTarget({ day: selectedDay, slot })}
                        className="flex w-full items-center gap-3 rounded-input border border-border p-3.5 text-left disabled:pointer-events-none"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
                          <Icon name="recipes" size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{filled.title}</span>
                          <span className="block text-xs text-muted">
                            {filled.kind === "recipe" ? "Our recipe" : "Your meal"} ·{" "}
                            {filled.kind === "recipe" ? filled.ingredientCount : filled.ingredientLines.length} things
                          </span>
                        </span>
                        <Icon name="caretDown" size={14} className="-rotate-90 shrink-0 text-muted" />
                      </button>
                    ) : (
                      <button
                        disabled={current.status === "SKIPPED"}
                        onClick={() => setAddTarget({ day: selectedDay, slot })}
                        className="flex w-full items-center gap-3 rounded-input border border-dashed border-border p-3.5 text-left text-muted disabled:pointer-events-none"
                      >
                        <Icon name="plus" size={16} />
                        Add {MEAL_SLOT_LABEL[slot].toLowerCase()}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {current.status !== "SKIPPED" && MEAL_SLOTS.some((s) => current.slots[s]?.kind === "recipe") && (
              <button
                disabled={isPending}
                onClick={() => startTransition(async () => { await sendDayIngredientsToBasket(weekOffset, selectedDay); router.refresh(); })}
                className="mt-3 text-sm font-semibold text-carbon underline disabled:opacity-50"
              >
                Send today&rsquo;s missing ingredients to basket
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-6 overflow-hidden overflow-x-auto rounded-input border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-soft-mist text-xs font-semibold text-muted">
                <th className="p-2 text-left"> </th>
                {MEAL_SLOTS.map((s) => (
                  <th key={s} className="p-2 text-left">
                    {MEAL_SLOT_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEAL_PLAN_DAYS.map((day) => {
                const dv = dayView(day);
                return (
                  <tr key={day} className="border-t border-border">
                    <td className={`p-2 align-top font-semibold ${basketShipDay === day ? "text-carbon" : ""}`}>
                      {DAY_SHORT[day]}
                    </td>
                    {MEAL_SLOTS.map((slot) => {
                      const filled = dv.slots[slot];
                      return (
                        <td key={slot} className="p-2 align-top">
                          <button
                            onClick={() =>
                              filled ? setMenuTarget({ day, slot }) : setAddTarget({ day, slot })
                            }
                            className="w-full text-left text-xs leading-snug hover:text-carbon"
                          >
                            {filled ? filled.title : <span className="text-border">+</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={toggleRepeat}
        disabled={isPending}
        className="mt-6 flex w-full items-center gap-3 rounded-input bg-soft-mist p-3.5 text-left disabled:opacity-60"
      >
        <span className="flex-1">
          <span className="block text-sm font-semibold">Use this timetable every week</span>
          <span className="block text-xs text-muted">Your shopping list refreshes each week</span>
        </span>
        <span
          className={`relative h-7 w-11 shrink-0 rounded-full transition-colors ${repeatsEnabled ? "bg-carbon" : "bg-border"}`}
          aria-hidden
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
              repeatsEnabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
      </button>

      <AddMealSheet
        open={Boolean(addTarget)}
        onClose={() => setAddTarget(null)}
        day={addTarget?.day ?? "MONDAY"}
        slot={addTarget?.slot ?? "dinner"}
        weekOffset={weekOffset}
        ownMealOptions={ownMealOptions}
        recipeOptions={recipeOptions}
        onDone={() => {
          setAddTarget(null);
          router.refresh();
        }}
      />

      <MealMenuSheet
        open={Boolean(menuTarget)}
        onClose={() => setMenuTarget(null)}
        slot={menuSlot}
        onViewRecipe={(recipeId) => {
          setMenuTarget(null);
          openRecipe(recipeId);
        }}
        onChange={() => {
          if (!menuTarget) return;
          setAddTarget(menuTarget);
          setMenuTarget(null);
        }}
        onRemove={() => menuTarget && clearSlot(menuTarget.day, menuTarget.slot)}
      />

      <RecipeSheet
        open={Boolean(recipeSheet)}
        onClose={() => setRecipeSheet(null)}
        recipe={recipeSheet}
        isSubscriber
        signedIn
      />

      <ShoppingListSheet open={shoppingListOpen} onClose={() => setShoppingListOpen(false)} weekOffset={weekOffset} />
    </div>
  );
}

/**
 * What a non-subscriber sees instead of the builder: no fake week behind a
 * blur, just the feature named and a way to unlock it — Meal Plan is
 * subscriber-only, full stop.
 */
export function MealPlanGate() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
      <Icon name="reward" size={22} className="text-carbon" />
      <h3 className="text-heading">Meal plan is for members</h3>
      <p className="max-w-xs text-muted">
        Subscribe to plan your week day by day and send what&rsquo;s missing straight to your basket.
      </p>
      <Link
        href="/subscribe"
        className="tap-target mt-1 rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white hover:bg-carbon/85"
      >
        Subscribe to unlock
      </Link>
    </div>
  );
}
