"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LinkButton } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { RollingNumber } from "@/components/ui/rolling-number";
import { formatNaira } from "@/lib/format";
import { haptic, press, spring } from "@/lib/motion/tokens";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";
import { checkoutStandingBasket } from "./actions";
import { DayPickerSheet, shipDayShortLabel } from "./day-picker-sheet";

/** ₦8,300 → "₦8.3k": short enough to sit on the collapsed button. */
function compactNaira(n: number) {
  if (n < 1000) return formatNaira(n);
  const k = n / 1000;
  return `₦${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * The one checkout control on this page. Desktop keeps a flush bar along the
 * bottom. Mobile gets a floating round button above the dock that morphs
 * open into the checkout card on tap, so the total never sits over the
 * basket list while the customer is editing it. Check out is always
 * enabled: a missing ship day or an empty basket becomes the next sheet
 * instead of a greyed-out dead end.
 */
export function BottomBar({
  basketId,
  runningValue,
  shipDay,
  hasItems,
  skipped,
  locked,
  hidden = false,
}: {
  basketId: string;
  runningValue: number;
  shipDay: ShoppingWindowDay | null;
  hasItems: boolean;
  skipped: boolean;
  locked: boolean;
  /** A delivered trial basket has nothing left to check out, so the bar doesn't render at all. */
  hidden?: boolean;
}) {
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [emptyNoticeOpen, setEmptyNoticeOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onPointer = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const doCheckout = () => startTransition(() => checkoutStandingBasket(basketId));

  if (hidden) return null;

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

  const openDayPicker = () => !skipped && !locked && setDayPickerOpen(true);
  const label = skipped ? "Skipped this week" : locked ? "Window closed" : isPending ? "Checking out…" : "Check out";
  const dayLabel = shipDay ? `Ships ${shipDayShortLabel(shipDay)}` : "Pick a day";

  return (
    <>
      {/* Desktop: the flush bar. The dock is a left rail up here, so nothing
          else competes for the bottom edge. */}
      <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) hidden border-t border-border bg-surface px-4 py-3 lg:block">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-muted">Total</p>
            <p className="text-base font-semibold">
              <RollingNumber value={runningValue} format={formatNaira} />
            </p>
          </div>
          <button
            onClick={openDayPicker}
            disabled={skipped || locked}
            className="tap-target min-w-0 flex-1 truncate rounded-full border border-border px-3 py-2 text-center text-sm font-medium hover:bg-sky-wash disabled:opacity-50"
          >
            {dayLabel}
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

      {/* Mobile: one element that morphs between a round button and the
          checkout card (layout animation), anchored bottom-right just above
          the floating dock's real footprint. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-(--dock-clearance) z-(--z-sticky) flex justify-end lg:hidden">
        <motion.div
          ref={cardRef}
          layout
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.sheet}
          style={{ borderRadius: expanded ? 28 : 999 }}
          className={`pointer-events-auto overflow-hidden border border-border shadow-[0_10px_30px_rgb(0_0_0/0.14)] ${
            expanded ? "w-full bg-surface" : "bg-carbon"
          }`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {expanded ? (
              <motion.div
                key="open"
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6, transition: { duration: 0.1 } }}
                transition={{ ...spring.snappy, delay: 0.05 }}
                className="p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted">Total</p>
                    <p className="text-2xl font-extrabold tracking-tight">
                      <RollingNumber value={runningValue} format={formatNaira} />
                    </p>
                  </div>
                  <motion.button
                    onClick={() => setExpanded(false)}
                    whileTap={{ scale: press.scale }}
                    aria-label="Collapse checkout"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-soft-mist"
                  >
                    <Icon name="caretDown" size={16} weight="bold" />
                  </motion.button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={openDayPicker}
                    disabled={skipped || locked}
                    className="tap-target inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-full border border-border px-3 py-3 text-sm font-medium disabled:opacity-50"
                  >
                    <Icon name="calendar" size={15} />
                    {dayLabel}
                  </button>
                  <motion.button
                    onClick={onCheckoutTap}
                    disabled={isPending || skipped || locked}
                    whileTap={{ scale: press.scale }}
                    className="tap-target flex-1 rounded-full bg-carbon px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {label}
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="closed"
                layout="position"
                onClick={() => {
                  haptic(8);
                  setExpanded(true);
                }}
                whileTap={{ scale: press.scale }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.08 } }}
                transition={spring.snappy}
                aria-label={`Checkout, total ${formatNaira(runningValue)}`}
                aria-expanded={false}
                className="relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 text-white"
              >
                <Icon name="cart" size={22} weight="fill" />
                <motion.span
                  key={runningValue}
                  initial={{ scale: 1.25 }}
                  animate={{ scale: 1 }}
                  transition={spring.juicy}
                  className="text-[11px] font-bold leading-none tabular-nums"
                >
                  {compactNaira(runningValue)}
                </motion.span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <DayPickerSheet
        basketId={basketId}
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
