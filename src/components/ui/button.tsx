"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { lift, press, spring } from "@/lib/motion/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Actions are carbon-filled or carbon-outlined only. The palette's saturated
// colours are decorative in this system and never carry an action. Danger is
// the one exception: an ember sticker fill for rare, destructive actions.
const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-carbon text-paper-white disabled:opacity-60",
  secondary: "border border-border bg-paper-white text-foreground disabled:opacity-60",
  ghost: "text-carbon underline underline-offset-2 disabled:opacity-60",
  danger: "border border-border bg-ember text-carbon disabled:opacity-60",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

function join(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// Shared pill-control shape: buttons and tags in this app are always fully
// rounded, per the structural design system (see AGENTS.md design notes).
// A ghost button carries no fill/border by design -- it's the underlined
// text-link pairing for a secondary action next to a filled primary one.
function baseClass(variant: Variant, size: Size, className?: string) {
  const shape = variant === "ghost" ? "" : "rounded-control font-semibold";
  return join(
    "relative inline-flex touch-manipulation select-none items-center justify-center transition-colors duration-(--dur-fast)",
    shape,
    VARIANT_CLASS[variant],
    variant === "ghost" ? "" : SIZE_CLASS[size],
    className,
  );
}

type ButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: React.ReactNode;
};

// Feedback lands on pointer-down (whileTap), never on click/release, and a
// small lift on hover for pointer devices — the "respond to the hand
// instantly" rule. Colour never shifts on press, only position.
export function Button({ variant = "primary", size = "md", loading, className, disabled, ref, children, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileHover={isDisabled ? undefined : { y: lift.y }}
      whileTap={isDisabled ? undefined : { scale: press.scale, y: press.y }}
      transition={spring.snappy}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={baseClass(variant, size, className)}
      {...props}
    >
      <span className={loading ? "invisible" : undefined}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-current"
              style={{ animation: `ripe-dot 900ms ${i * 120}ms var(--ease-in-out, ease-in-out) infinite` }}
            />
          ))}
        </span>
      )}
    </motion.button>
  );
}

const MotionLink = motion.create(Link);

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
  target?: string;
  rel?: string;
  "aria-label"?: string;
  onClick?: () => void;
};

export function LinkButton({ href, variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return (
    <MotionLink
      href={href}
      whileHover={{ y: lift.y }}
      whileTap={{ scale: press.scale, y: press.y }}
      transition={spring.snappy}
      className={baseClass(variant, size, className)}
      {...props}
    />
  );
}
