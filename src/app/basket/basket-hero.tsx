"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { nextShoppingWindowDate, SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";
import { DayPickerSheet } from "./day-picker-sheet";
import { BasketsSheet, type SheetBasket } from "./baskets-sheet";

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" });

/**
 * The whole signed-in experience in miniature: which basket this is, whether
 * it recurs or is a one-time trial, and when it ships. Mirrors the "hero"
 * block of the basket-home design, minus the running-value line (that lives
 * in the fixed bottom bar, never duplicated here).
 */
export function BasketHero({
  basketId,
  basketName,
  shipDay,
  isMemberPriced,
  trialDelivered,
  deliveredOn,
  baskets,
  isSubscriber,
  autoOpenDayPicker = false,
}: {
  basketId: string;
  basketName: string;
  shipDay: ShoppingWindowDay | null;
  /** Whether this specific basket is priced at member rates, locked at creation. */
  isMemberPriced: boolean;
  trialDelivered: boolean;
  deliveredOn: Date | null;
  baskets: SheetBasket[];
  isSubscriber: boolean;
  autoOpenDayPicker?: boolean;
}) {
  const router = useRouter();
  const [dayPickerOpen, setDayPickerOpen] = useState(autoOpenDayPicker);
  const [basketsOpen, setBasketsOpen] = useState(false);

  useEffect(() => {
    if (autoOpenDayPicker) router.replace(`/basket?b=${basketId}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="pt-1">
      <button
        onClick={() => setBasketsOpen(true)}
        className="inline-flex items-center gap-1 text-[28px] font-extrabold leading-none tracking-tight"
      >
        {basketName}
        <Icon name="caretDown" size={20} weight="bold" />
      </button>

      {trialDelivered ? (
        <button disabled className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-soft-mist px-3.5 py-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-muted">
            <Icon name="lock" size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold">Trial finished</b>
            <small className="block text-[13px] text-muted">
              {deliveredOn ? `Delivered on ${SHORT_DATE.format(deliveredOn)}` : "Delivered"}
            </small>
          </span>
        </button>
      ) : isMemberPriced ? (
        <button
          onClick={() => setDayPickerOpen(true)}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-mint-pop/25 px-3.5 py-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-carbon">
            <Icon name="recurring" size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold">
              {shipDay ? `Comes every ${SHOPPING_WINDOW_DAY_LABEL[shipDay]}` : "Pick your delivery day"}
            </b>
            <small className="block text-[13px] text-muted">Change what is inside until the day before</small>
          </span>
          <span className="shrink-0 text-sm font-semibold text-carbon">Change</span>
        </button>
      ) : (
        <>
          <span className="mt-2.5 inline-block rounded-full bg-lavender px-2.5 py-1 text-[13px] font-semibold text-carbon">
            Free trial
          </span>
          <p className="mt-2.5 text-[15px] leading-snug text-muted">
            A basket is produce that comes to you <b className="font-semibold text-foreground">every week</b>. This
            is your free try, so it comes <b className="font-semibold text-foreground">once</b>.
          </p>
          <button
            onClick={() => setDayPickerOpen(true)}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-sky-wash px-3.5 py-3 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-carbon">
              <Icon name="calendar" size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">
                {shipDay
                  ? SHORT_DATE.format(nextShoppingWindowDate(shipDay))
                  : "Pick a day"}
              </b>
              <small className="block text-[13px] text-muted">Delivering to your zone</small>
            </span>
            <span className="shrink-0 text-sm font-semibold text-carbon">Change</span>
          </button>
        </>
      )}

      <DayPickerSheet
        basketId={basketId}
        open={dayPickerOpen}
        onClose={() => setDayPickerOpen(false)}
        currentDay={shipDay}
      />
      <BasketsSheet
        open={basketsOpen}
        onClose={() => setBasketsOpen(false)}
        baskets={baskets}
        activeId={basketId}
        isSubscriber={isSubscriber}
      />
    </section>
  );
}
