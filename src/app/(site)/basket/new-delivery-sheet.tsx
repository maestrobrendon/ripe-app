"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cutoffLabel, dayName, shortDate } from "@/lib/delivery-labels";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { haptic } from "@/lib/haptics";
import { spring } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { MENU_GOALS, type MenuGoal } from "@/lib/menu-types";
import { newDelivery } from "./actions";

/** One of the area's delivery days, with its next date and when that closes. */
export type DayOption = { day: DeliveryDay; dateIso: string; cutoffIso: string };

const ALL_DAYS: DeliveryDay[] = ["THURSDAY", "FRIDAY", "SATURDAY"];
const NAMES = ["For Mum", "Office", "Weekend"];
const STEPS = 3;

/**
 * A new basket, one question at a time: what to call it, which day it
 * comes, and (if they like) what it's for. Each step is a heading, one
 * control and one button; Back is the only way sideways.
 */
export function NewDeliverySheet({ open, onClose, dayOptions }: { open: boolean; onClose: () => void; dayOptions: DayOption[] }) {
  const days = dayOptions.length ? dayOptions : ALL_DAYS.map((day) => ({ day, dateIso: null, cutoffIso: null }));
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState("");
  const [day, setDay] = useState<DeliveryDay>(days[0].day);
  // Optional: what this basket is for. Its Home follows it; left empty, it follows theirs.
  const [goal, setGoal] = useState<MenuGoal | null>(null);
  const [pending, start] = useTransition();

  const go = (next: number) => {
    haptic("selection");
    setDir(next > step ? 1 : -1);
    setStep(next);
  };
  const close = () => {
    onClose();
    // Start from the top next time, once the sheet has gone.
    setTimeout(() => setStep(0), 300);
  };
  const create = () => {
    haptic("light");
    try {
      sessionStorage.setItem("basket.created", name.trim());
    } catch {
      /* the message is a nicety */
    }
    start(() => newDelivery({ name, day, goal }));
  };

  const chosen = days.find((d) => d.day === day);
  const slide = reduced
    ? {}
    : { initial: { opacity: 0, x: 28 * dir }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -28 * dir }, transition: spring.smooth };

  return (
    <BottomSheet open={open} onClose={close} title="New basket" desktopDialog>
      {/* Where you are: three short bars, the current one dark. */}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="-ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-soft-mist active:scale-95">
            <Icon name="caretLeft" size={16} weight="bold" />
          </button>
        )}
        <div className="flex flex-1 gap-1.5" aria-label={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-carbon" : "bg-carbon/10"}`} />
          ))}
        </div>
      </div>

      <div className="relative mt-6 min-h-[17rem] overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          {step === 0 && (
            <motion.div key="name" {...slide}>
              <h3 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">What should we call it?</h3>
              <p className="mt-1.5 text-[15px] text-muted">A basket with its own produce and its own day.</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && go(1)}
                maxLength={40}
                placeholder="Name"
                aria-label="Basket name"
                autoComplete="off"
                className="mt-6 h-14 w-full rounded-2xl bg-soft-mist px-4 text-[17px] outline-none focus:bg-surface focus:ring-2 focus:ring-carbon"
              />
              <div className="mt-3 flex gap-2">
                {NAMES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      haptic("selection");
                      setName(n);
                    }}
                    className={`h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors ${name === n ? "bg-carbon text-paper-white" : "bg-soft-mist"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="day" {...slide}>
              <h3 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">Which day?</h3>
              <p className="mt-1.5 text-[15px] text-muted">It comes every week on this day until you pause it.</p>
              {/* One segmented control, and one line that answers "when's the first one?" */}
              <div className="mt-6 grid rounded-full bg-soft-mist p-1" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }} role="radiogroup" aria-label="Delivery day">
                {days.map((o) => {
                  const on = o.day === day;
                  return (
                    <button
                      key={o.day}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        haptic("selection");
                        setDay(o.day);
                      }}
                      className="relative h-11 rounded-full text-[15px] font-semibold"
                    >
                      {on && <motion.span layoutId="new-basket-day" transition={spring.indicator} className="absolute inset-0 rounded-full bg-surface shadow-[0_2px_8px_-2px_rgb(0_0_0/0.2)]" />}
                      <span className={`relative ${on ? "" : "text-carbon/55"}`}>{dayName(o.day).slice(0, 3)}</span>
                    </button>
                  );
                })}
              </div>
              {chosen?.dateIso && chosen.cutoffIso && (
                <p className="mt-5 text-center text-[15px]">
                  First one <b className="font-semibold">{shortDate(chosen.dateIso)}</b>
                  <span className="block text-[13px] text-muted">Confirm by {cutoffLabel(chosen.cutoffIso)}</span>
                </p>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="goal" {...slide}>
              <h3 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">What&apos;s it for?</h3>
              <p className="mt-1.5 text-[15px] text-muted">Optional. We&apos;ll suggest recipes and produce to match.</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                {MENU_GOALS.map((g) => {
                  const on = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        haptic("selection");
                        setGoal(on ? null : g.id);
                      }}
                      className={`flex h-12 items-center justify-between rounded-2xl px-4 text-left text-[15px] font-medium transition-colors ${on ? "bg-carbon text-paper-white" : "bg-soft-mist"}`}
                    >
                      {g.short}
                      {on && <Icon name="checkPlain" size={16} weight="bold" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {step < 2 ? (
        <Button className="mt-4 w-full" size="lg" disabled={step === 0 && !name.trim()} onClick={() => go(step + 1)}>
          Continue
        </Button>
      ) : (
        <Button className="mt-4 w-full" size="lg" loading={pending} onClick={create}>
          {goal ? "Create basket" : "Skip and create"}
        </Button>
      )}
    </BottomSheet>
  );
}
