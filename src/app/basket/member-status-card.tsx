"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StreakBadge } from "@/components/streak-badge";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import type { StreakView } from "@/lib/streak-config";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";
import { DayPickerSheet } from "./day-picker-sheet";
import { IdeasSheetTrigger } from "./ideas-sheet-trigger";

/**
 * The one card above everything else: this is the whole signed-in experience
 * in miniature. Ship day is stated as a fact once set, or posed as the most
 * prominent unresolved question on the page until it is.
 */
export function MemberStatusCard({
  firstName,
  shipDay,
  runningValue,
  isSubscriber,
  savings,
  potentialSavings,
  streak,
  signature,
  locked,
  autoOpenDayPicker = false,
}: {
  firstName: string;
  shipDay: ShoppingWindowDay | null;
  runningValue: number;
  isSubscriber: boolean;
  savings: number;
  potentialSavings: number;
  streak: StreakView;
  signature: string;
  locked: boolean;
  autoOpenDayPicker?: boolean;
}) {
  const router = useRouter();
  // A header tap on another page routes here with ?pickDay=1; the initial
  // state opens the sheet immediately, and this effect only cleans the URL.
  const [dayPickerOpen, setDayPickerOpen] = useState(autoOpenDayPicker);

  useEffect(() => {
    if (autoOpenDayPicker) router.replace("/basket", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-card-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      <h1 className="text-heading-lg">{firstName}, your week</h1>

      {shipDay ? (
        <button
          onClick={() => setDayPickerOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-carbon underline decoration-border underline-offset-2 hover:decoration-carbon"
        >
          Ships {SHOPPING_WINDOW_DAY_LABEL[shipDay]}
          <Icon name="edit" size={13} strokeWidth={2} />
        </button>
      ) : (
        <button
          onClick={() => setDayPickerOpen(true)}
          className="tap-target mt-3 inline-flex items-center gap-2 rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-carbon/85"
        >
          Pick a ship day
        </button>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-muted">Running value</span>
        <span className="text-2xl font-semibold">{formatNaira(runningValue)}</span>
      </div>

      {isSubscriber && savings > 0 && (
        <p className="mt-1 text-sm text-carbon">You&rsquo;ve saved {formatNaira(savings)} on this basket</p>
      )}
      {!isSubscriber && potentialSavings > 0 && (
        <a href="/subscribe" className="mt-1 block text-sm text-carbon underline">
          You&rsquo;d save {formatNaira(potentialSavings)} on this basket as a member
        </a>
      )}

      {streak.currentStreakWeeks > 0 && (
        <div className="mt-3">
          <StreakBadge view={streak} />
        </div>
      )}

      <div className="mt-4 lg:hidden">
        <IdeasSheetTrigger signature={signature} locked={locked} />
      </div>

      <DayPickerSheet
        open={dayPickerOpen}
        onClose={() => setDayPickerOpen(false)}
        currentDay={shipDay}
      />
    </div>
  );
}
