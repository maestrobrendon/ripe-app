"use client";

import { useState, useTransition } from "react";
import { LinkButton } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { formatNaira } from "@/lib/format";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";
import { checkoutStandingBasket } from "./actions";
import { DayPickerSheet, shipDayShortLabel } from "./day-picker-sheet";

/**
 * The one checkout control on this page, fixed to the bottom of the viewport
 * at every width. Check out is always enabled: a missing ship day or an empty
 * basket becomes the next sheet instead of a greyed-out dead end.
 */
export function BottomBar({
  runningValue,
  shipDay,
  hasItems,
  skipped,
  locked,
}: {
  runningValue: number;
  shipDay: ShoppingWindowDay | null;
  hasItems: boolean;
  skipped: boolean;
  locked: boolean;
}) {
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [emptyNoticeOpen, setEmptyNoticeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const doCheckout = () => startTransition(() => checkoutStandingBasket());

  const onCheckoutTap = () => {
    if (skipped || locked) return;
    if (!hasItems) {
      setEmptyNoticeOpen(true);
      return;
    }
    if (!shipDay) {
      setDayPickerOpen(true);
      return;
    }
    doCheckout();
  };

  const label = skipped ? "Skipped this week" : locked ? "Window closed" : isPending ? "Checking out…" : "Check out";

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-muted">Total</p>
            <p className="text-base font-semibold">{formatNaira(runningValue)}</p>
          </div>

          <button
            onClick={() => !skipped && !locked && setDayPickerOpen(true)}
            disabled={skipped || locked}
            className="tap-target flex-1 truncate rounded-full border border-border px-3 py-2 text-center text-sm font-medium hover:bg-sky-wash disabled:opacity-50"
          >
            {shipDay ? `Ships ${shipDayShortLabel(shipDay)}` : "Pick a day"}
          </button>

          <button
            onClick={onCheckoutTap}
            disabled={isPending || skipped || locked}
            className="tap-target shrink-0 rounded-full bg-carbon px-5 py-2.5 text-sm font-semibold text-white hover:bg-carbon/85 disabled:opacity-50"
          >
            {label}
          </button>
        </div>
      </div>

      <DayPickerSheet
        open={dayPickerOpen}
        onClose={() => setDayPickerOpen(false)}
        currentDay={shipDay}
        onPicked={() => doCheckout()}
      />

      <BottomSheet open={emptyNoticeOpen} onClose={() => setEmptyNoticeOpen(false)} title="Your basket is empty">
        <p className="text-sm text-muted">Add a few things before checking out. Ideas can put together a starter set in one tap.</p>
        <LinkButton
          href="/shop"
          size="md"
          className="mt-4 w-full"
          onClick={() => setEmptyNoticeOpen(false)}
        >
          Browse the shop
        </LinkButton>
      </BottomSheet>
    </>
  );
}
