"use client";

/**
 * <QuantityStepper /> — the one stepper. Replaces the hand-built +/− rows in
 * product-card, cart-drawer and buy-box.
 *
 * Behaviour
 *  - quantity 0  → a carbon "Add" pill (primary CTA). Tap = onChange(min).
 *  - quantity >0 → the pill MORPHS (layout animation) into − n +.
 *  - When the next "−" would drop below `min`, the minus becomes a trash icon.
 *  - Numbers roll in the direction of change. Haptic tick on commit.
 *  - Optimistic: the parent should update quantity immediately; `loading`
 *    only dims, it never blocks further taps (interruptible).
 */

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { RollingNumber } from "./rolling-number";
import { haptic, press, spring } from "@/lib/motion/tokens";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  quantity: number;
  min: number;
  step: number;
  onChange: (next: number) => void;
  /** Product name for accessible labels ("Add pineapple", "Remove pineapple"). */
  label: string;
  /** e.g. grams → "250g", pairs → "4". Defaults to the raw number. */
  formatQuantity?: (n: number) => string;
  /** Suffix shown beside the number in "card" variant, e.g. "in cart". */
  suffix?: string;
  addLabel?: string;
  variant?: "card" | "inline" | "hero";
  loading?: boolean;
  disabled?: boolean;
  /** Called with the Add button element so the parent can launch a fly-to-cart. */
  onAddFrom?: (el: HTMLElement) => void;
  /** Hide the "Add" state entirely (e.g. buy box, where qty starts at min). */
  alwaysStepper?: boolean;
  className?: string;
};

const heights = { card: "h-9", inline: "h-8", hero: "h-14" } as const;
const btnSize = { card: "size-8", inline: "size-7", hero: "size-11" } as const;
const iconSize = { card: 14, inline: 13, hero: 18 } as const;

export function QuantityStepper({
  quantity,
  min,
  step,
  onChange,
  label,
  formatQuantity = String,
  suffix,
  addLabel = "Add",
  variant = "card",
  loading,
  disabled,
  onAddFrom,
  alwaysStepper,
  className,
}: Props) {
  const showStepper = alwaysStepper || quantity > 0;
  const willRemove = !alwaysStepper && quantity - step < min;
  const atFloor = alwaysStepper && quantity - step < min;

  const dec = () => {
    if (atFloor) return;
    haptic(6);
    onChange(willRemove ? 0 : quantity - step);
  };
  const inc = () => {
    haptic(8);
    onChange(quantity + step);
  };

  return (
    <motion.div
      layout
      transition={spring.smooth}
      style={{ borderRadius: 9999 }}
      className={cn(
        "relative flex items-center overflow-hidden rounded-control border border-border",
        heights[variant],
        variant === "inline" ? "w-auto" : "w-full",
        showStepper ? "bg-paper-white" : "bg-carbon",
        loading && "opacity-70",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!showStepper ? (
          <motion.button
            key="add"
            type="button"
            disabled={disabled}
            onClick={(e) => {
              haptic(10);
              onAddFrom?.(e.currentTarget);
              onChange(min);
            }}
            whileTap={{ scale: press.scale }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={spring.snappy}
            className="flex h-full w-full items-center justify-center gap-1.5 text-sm font-semibold text-paper-white"
            aria-label={`${addLabel} ${label}`}
          >
            <Plus size={iconSize[variant]} weight="bold" aria-hidden />
            {addLabel}
          </motion.button>
        ) : (
          <motion.div
            key="stepper"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
            className="flex h-full w-full items-center justify-between gap-1 px-1"
          >
            <StepButton
              onClick={dec}
              disabled={disabled || atFloor}
              label={willRemove ? `Remove ${label}` : `Reduce ${label}`}
              size={btnSize[variant]}
              tone={willRemove ? "danger" : "default"}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={willRemove ? "trash" : "minus"}
                  initial={{ rotate: -30, scale: 0.6, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 30, scale: 0.6, opacity: 0 }}
                  transition={spring.snappy}
                  className="inline-flex"
                >
                  {willRemove ? (
                    <Trash size={iconSize[variant]} weight="bold" aria-hidden />
                  ) : (
                    <Minus size={iconSize[variant]} weight="bold" aria-hidden />
                  )}
                </motion.span>
              </AnimatePresence>
            </StepButton>

            <span className="flex min-w-8 items-baseline justify-center gap-1 px-1 text-sm font-semibold text-carbon">
              <RollingNumber value={quantity} format={formatQuantity} />
              {suffix && variant === "card" && <span className="text-xs font-normal text-muted">{suffix}</span>}
            </span>

            <StepButton onClick={inc} disabled={disabled} label={`Add one more ${label}`} size={btnSize[variant]}>
              <Plus size={iconSize[variant]} weight="bold" aria-hidden />
            </StepButton>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  label,
  size,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  size: string;
  tone?: "default" | "danger";
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={{ scale: 0.86 }}
      transition={spring.snappy}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-carbon transition-colors duration-(--dur-fast) disabled:opacity-35",
        tone === "danger" ? "hover:bg-ember/30" : "hover:bg-sky-wash",
        size,
      )}
    >
      {children}
    </motion.button>
  );
}
