"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SHOPPING_WINDOW_DAYS, SHOPPING_WINDOW_DAY_SHORT_LABEL } from "@/lib/shopping-window";
import { setShoppingWindowDay } from "./actions";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";

export function shipDayShortLabel(day: ShoppingWindowDay | null): string | null {
  return day ? SHOPPING_WINDOW_DAY_SHORT_LABEL[day] : null;
}

/**
 * The one place a shopping window day gets picked. Both the status card's
 * "Pick a ship day" prompt and the bottom bar's day chip open this same sheet
 * rather than each rolling its own <select>.
 */
export function DayPickerSheet({
  open,
  onClose,
  currentDay,
  onPicked,
}: {
  open: boolean;
  onClose: () => void;
  currentDay: ShoppingWindowDay | null;
  /** Called after the day is saved, e.g. to continue on to checkout. */
  onPicked?: (day: ShoppingWindowDay) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const pick = (day: ShoppingWindowDay) => {
    startTransition(async () => {
      await setShoppingWindowDay(day);
      router.refresh();
      onPicked?.(day);
      onClose();
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Pick a ship day">
      <p className="text-sm text-muted">
        This is when your basket would go out if you check out. It does not charge you or start a
        countdown.
      </p>
      <div className="mt-4 space-y-2">
        {SHOPPING_WINDOW_DAYS.map((d) => (
          <button
            key={d.day}
            disabled={isPending}
            onClick={() => pick(d.day)}
            className={`w-full rounded-input border p-3 text-left text-sm transition disabled:opacity-50 ${
              currentDay === d.day ? "border-carbon bg-lavender" : "border-border hover:bg-sky-wash"
            }`}
          >
            <span className="font-semibold">{d.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{d.cutoffCopy}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
