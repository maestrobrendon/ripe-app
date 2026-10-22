"use client";

import { motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";

/** A selectable card whose ring slides between options within the same group. */
export function RadioCard({
  selected,
  onSelect,
  groupId,
  disabled,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  groupId: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`relative block w-full rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-60 ${
        selected ? "border-carbon bg-sky-wash" : "border-border bg-paper-white hover:bg-sky-wash/40"
      }`}
    >
      {selected && (
        <motion.span
          layoutId={`${groupId}-ring`}
          transition={spring.indicator}
          className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-carbon"
          aria-hidden
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}
