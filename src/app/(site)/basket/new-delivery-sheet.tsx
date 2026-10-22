"use client";

import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cutoffLabel, dayName, shortDate } from "@/lib/delivery-labels";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { haptic } from "@/lib/haptics";
import { MENU_GOALS, type MenuGoal } from "@/lib/menu-types";
import { newDelivery } from "./actions";

/** One of the area's delivery days, with its next date and when that closes. */
export type DayOption = { day: DeliveryDay; dateIso: string; cutoffIso: string };

const ALL_DAYS: DeliveryDay[] = ["THURSDAY", "FRIDAY", "SATURDAY"];
const NAMES = ["For Mum", "Office", "Weekend"];

/** A new basket: a name the customer will recognise, and its day. */
export function NewDeliverySheet({ open, onClose, dayOptions }: { open: boolean; onClose: () => void; dayOptions: DayOption[] }) {
  const days = dayOptions.length ? dayOptions : ALL_DAYS.map((day) => ({ day, dateIso: null, cutoffIso: null }));
  const [name, setName] = useState("");
  const [day, setDay] = useState<DeliveryDay>(days[0].day);
  // Optional: what this basket is for. Its Home follows it; left empty, it follows theirs.
  const [goal, setGoal] = useState<MenuGoal | null>(null);
  const [pending, start] = useTransition();

  return (
    <BottomSheet open={open} onClose={onClose} title="New basket" desktopDialog>
      <p className="text-sm text-muted">For someone else, like your mum, or a second drop in the week. It has its own produce and its own day, and comes every week until you pause it.</p>

      <label className="mt-4 block text-sm font-medium" htmlFor="delivery-name">
        What should we call it?
      </label>
      <input
        id="delivery-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="For Mum"
        autoComplete="off"
        className="mt-1.5 h-12 w-full rounded-control border border-hairline bg-surface px-4 text-base outline-none focus:border-carbon"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {NAMES.map((n) => (
          <button key={n} type="button" onClick={() => setName(n)} className="rounded-full border border-hairline px-3 py-1 text-sm">
            {n}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm font-medium">
        What&apos;s it for? <span className="font-normal text-muted">(optional)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MENU_GOALS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={goal === g.id}
            onClick={() => {
              haptic("selection");
              setGoal(goal === g.id ? null : g.id);
            }}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${goal === g.id ? "bg-carbon text-paper-white" : "border border-hairline"}`}
          >
            {g.short}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm font-medium">Which day?</p>
      <div className="mt-2 grid gap-2">
        {days.map((o) => (
          <button
            key={o.day}
            type="button"
            onClick={() => setDay(o.day)}
            aria-pressed={day === o.day}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${day === o.day ? "border-carbon bg-mint-pop/20" : "border-hairline bg-surface"}`}
          >
            <span>
              <b className="block font-semibold">{dayName(o.day)}s</b>
              {o.dateIso && o.cutoffIso && (
                <small className="block text-[13px] text-muted">
                  First one {shortDate(o.dateIso)} · confirm by {cutoffLabel(o.cutoffIso)}
                </small>
              )}
            </span>
            <span className={`size-5 rounded-full border-2 ${day === o.day ? "border-carbon bg-carbon shadow-[inset_0_0_0_3px_var(--surface)]" : "border-hairline"}`} />
          </button>
        ))}
      </div>

      <Button className="mt-5 w-full" size="lg" loading={pending} disabled={!name.trim()} onClick={() => {
          haptic("light");
          try {
            sessionStorage.setItem("basket.created", name.trim());
          } catch {
            /* the message is a nicety */
          }
          start(() => newDelivery({ name, day, goal }));
        }}>
        Create basket
      </Button>
    </BottomSheet>
  );
}
