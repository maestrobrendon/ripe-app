import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "feature";
};

function join(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// The de-facto card shape used across the app, formalized: hairline border +
// surface fill instead of a drop shadow, per the flat/structural design system.
// "feature" is the larger-radius variant for hero panels and dark section cards.
export function Card({ variant = "default", className, ...props }: CardProps) {
  const radius = variant === "feature" ? "rounded-card-lg" : "rounded-card";
  const padding = variant === "feature" ? "p-6 sm:p-8" : "p-4 sm:p-5";
  return (
    <div
      className={join(radius, padding, "border border-border bg-surface", className)}
      {...props}
    />
  );
}
