"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MEAL_PLAN_DAYS, MEAL_SLOTS, MEAL_SLOT_LABEL, type MealPlanDay, type MealSlotKey } from "@/lib/meal-plan-types";

const DAY_SHORT: Record<MealPlanDay, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

/**
 * The one day/slot picker, used both for "Add to my timetable" from a recipe
 * sheet and for choosing where a new own meal goes. Always targets this
 * week (the timetable has no far-future picking in this design).
 */
export function SlotPickerSheet({
  open,
  onClose,
  mealName,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  mealName: string;
  onPick: (day: MealPlanDay, slot: MealSlotKey) => void;
}) {
  const [day, setDay] = useState<MealPlanDay>("MONDAY");
  const [slot, setSlot] = useState<MealSlotKey>("dinner");

  return (
    <BottomSheet open={open} onClose={onClose} title="Add to your timetable">
      <p className="text-sm text-muted">{mealName}</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Day</p>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {MEAL_PLAN_DAYS.map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            aria-pressed={d === day}
            className={`rounded-input py-2.5 text-xs font-semibold ${
              d === day ? "bg-carbon text-white" : "border border-border hover:bg-sky-wash"
            }`}
          >
            {DAY_SHORT[d]}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Meal</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {MEAL_SLOTS.map((s) => (
          <button
            key={s}
            onClick={() => setSlot(s)}
            aria-pressed={s === slot}
            className={`rounded-input py-2.5 text-sm font-semibold ${
              s === slot ? "bg-carbon text-white" : "border border-border hover:bg-sky-wash"
            }`}
          >
            {MEAL_SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPick(day, slot)}
        className="tap-target mt-5 w-full rounded-full bg-carbon py-3 text-sm font-semibold text-white"
      >
        Add to {DAY_SHORT[day]} {MEAL_SLOT_LABEL[slot].toLowerCase()}
      </button>
    </BottomSheet>
  );
}
