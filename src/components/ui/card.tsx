import type { HTMLAttributes } from "react";

type Tone = "surface" | "tint";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "feature";
  tone?: Tone;
};

// Colour lives here rather than in a caller's className: Tailwind resolves
// competing utilities by stylesheet order, not class order, so a `bg-*` passed
// in className silently loses to the one set here.
const TONE_CLASS: Record<Tone, string> = {
  surface: "border-border bg-surface",
  tint: "border-basket-green bg-basket-green-light",
};

function join(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// The de-facto card shape used across the app, formalized: hairline border +
// fill instead of a drop shadow, per the flat/structural design system.
// "feature" is the larger-radius variant for hero panels and section blocks.
export function Card({ variant = "default", tone = "surface", className, ...props }: CardProps) {
  const radius = variant === "feature" ? "rounded-card-lg" : "rounded-card";
  const padding = variant === "feature" ? "p-6 sm:p-8" : "p-4 sm:p-5";
  return (
    <div className={join(radius, padding, "border", TONE_CLASS[tone], className)} {...props} />
  );
}
