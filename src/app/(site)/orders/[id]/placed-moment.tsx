"use client";

import { motion } from "motion/react";
import { SuccessMark } from "@/components/ui/success-mark";
import { Icon } from "@/components/ui/icon";
import { spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";

/**
 * Straight after confirming: the check, what was just agreed (the day, the
 * window, how it's paid), and one useful next step, putting it in the
 * calendar. The order's details follow underneath.
 */
export function PlacedMoment({ when, pay, receiptTo, calendarHref }: { when: string; pay: string; receiptTo: string | null; calendarHref: string }) {
  const rise = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { ...spring.smooth, delay: 0.35 + i * 0.07 } });
  return (
    <section className="mt-2 flex flex-col items-center rounded-[28px] bg-surface px-6 pt-8 pb-6 text-center ring-1 ring-hairline" aria-live="polite">
      <SuccessMark />
      <motion.h2 {...rise(0)} className="mt-5 text-[26px] leading-tight font-bold tracking-[-0.02em]">
        Basket confirmed
      </motion.h2>
      <motion.p {...rise(1)} className="mt-1.5 text-[16px]">
        {when}
      </motion.p>
      <motion.p {...rise(2)} className="mt-1 text-[14px] text-muted">
        {pay}
        {receiptTo ? ` · Receipt sent to ${receiptTo}` : ""}
      </motion.p>
      <motion.a
        {...rise(3)}
        href={calendarHref}
        onClick={() => haptic("selection")}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-soft-mist px-5 text-[15px] font-semibold transition-transform active:scale-[0.97]"
      >
        <Icon name="calendar" size={18} />
        Add to calendar
      </motion.a>
    </section>
  );
}
