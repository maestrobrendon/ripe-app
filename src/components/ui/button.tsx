import Link from "next/link";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

// Actions are carbon-filled or carbon-outlined only. The palette's saturated
// colours are decorative in this system and never carry an action.
const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-carbon text-paper-white hover:bg-carbon/85 disabled:opacity-60",
  secondary:
    "border border-border bg-paper-white text-foreground hover:bg-sky-wash disabled:opacity-60",
  ghost: "text-carbon underline underline-offset-2 hover:text-carbon/70 disabled:opacity-60",
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
  return join("inline-flex items-center justify-center transition", shape, VARIANT_CLASS[variant], variant === "ghost" ? "" : SIZE_CLASS[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={baseClass(variant, size, className)} {...props} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
};

export function LinkButton({ href, variant = "primary", size = "md", className, ...props }: LinkButtonProps) {
  return <Link href={href} className={baseClass(variant, size, className)} {...props} />;
}
