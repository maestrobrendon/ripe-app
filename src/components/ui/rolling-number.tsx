"use client";

/**
 * <RollingNumber /> — odometer-style number change.
 * Increases roll UP, decreases roll DOWN, so the direction of motion matches
 * the direction of the change. Used by QuantityStepper, cart badge, prices,
 * totals and streaks.
 *
 * Reduced motion: MotionConfig disables the y-roll; the cross-fade remains.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";

type Props = {
  value: number;
  format?: (n: number) => string;
  className?: string;
};

function join(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function RollingNumber({ value, format = String, className }: Props) {
  // "Adjust state during render" pattern: remember the last value to know the direction.
  const [last, setLast] = useState({ value, direction: 1 as 1 | -1 });
  if (last.value !== value) setLast({ value, direction: value >= last.value ? 1 : -1 });
  const direction = last.value !== value ? (value >= last.value ? 1 : -1) : last.direction;

  return (
    <span
      className={join("relative inline-flex overflow-hidden align-bottom tabular-nums", className)}
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={{
            enter: (d: number) => ({ y: d > 0 ? "100%" : "-100%", opacity: 0 }),
            center: { y: "0%", opacity: 1 },
            exit: (d: number) => ({ y: d > 0 ? "-100%" : "100%", opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring.number}
          className="inline-block"
        >
          {format(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
