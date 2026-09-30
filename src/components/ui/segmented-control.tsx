"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  groupId,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  groupId: string;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="relative grid auto-cols-fr grid-flow-col gap-0 rounded-full border border-border bg-soft-mist p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`relative z-10 flex h-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${active ? "text-paper-white" : "text-carbon"}`}
          >
            {active && (
              <motion.span
                layoutId={`${groupId}-thumb`}
                transition={spring.indicator}
                className="absolute inset-0 -z-10 rounded-full bg-carbon"
                aria-hidden
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
