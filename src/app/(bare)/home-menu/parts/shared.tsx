"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { ProductImage } from "@/components/product-image";
import type { MenuRecipe } from "../recipes";
import type { MenuProduct } from "../types";

/** "Chilli Pepper (Ata Rodo)" reads as "Chilli Pepper" in a recipe list. */
export function shortName(name: string) {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

/** The local name in brackets, when the catalogue has one. */
export function localName(name: string) {
  return name.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
}

/** Splits a recipe into what Basket sends and what the customer picks up. */
export function splitRecipe(recipe: MenuRecipe, products: Record<string, MenuProduct>) {
  const basket = recipe.basket.map((s) => products[s]).filter((p): p is MenuProduct => Boolean(p));
  // A slug the catalogue no longer has is still an ingredient: it moves to "elsewhere".
  const missing = recipe.basket.filter((s) => !products[s]).map((s) => s.replace(/-/g, " "));
  const elsewhere = [...missing.map((m) => m[0].toUpperCase() + m.slice(1)), ...recipe.elsewhere];
  return { basket, elsewhere, total: basket.length + elsewhere.length };
}

/** A small coloured label above a headline, the way the section is filed. */
export function Eyebrow({ children, className = "text-[#0f7a48]" }: { children: ReactNode; className?: string }) {
  return <p className={`mb-4 text-[15px] font-semibold tracking-[-0.01em] ${className}`}>{children}</p>;
}

/** One pill per ingredient: mint and solid from your basket, dashed ember from elsewhere. */
export function IngredientChip({ product, label, size = "md" }: { product?: MenuProduct; label?: string; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-8 text-[13px]" : "h-10 text-[14px]";
  if (product) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full bg-paper-white py-1 pr-3.5 pl-1 font-medium shadow-[0_0_0_1px_var(--hm-line)] ${h}`}>
        <ProductImage
          publicId={product.cloudinaryPublicId}
          alt=""
          emoji={product.imageEmoji}
          sizes="32px"
          rounded="rounded-full"
          flavour="bg-[#e8ede3]"
          emojiClassName="text-sm"
          className={size === "sm" ? "h-6 w-6" : "h-8 w-8"}
        />
        {shortName(product.name)}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-[1.5px] border-dashed border-ember px-3.5 font-medium text-carbon/80 ${h}`}>
      {label}
    </span>
  );
}

/**
 * How much of a recipe the basket covers, as one segment per ingredient.
 * Mint for what arrives, an ember outline for what does not.
 */
export function ShareMeter({ have, total, className = "", animate = true }: { have: number; total: number; className?: string; animate?: boolean }) {
  return (
    <div className={className}>
      <div className="flex gap-[3px]" role="img" aria-label={`${have} of ${total} ingredients come in your basket`}>
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            initial={animate ? { scaleY: 0.2, opacity: 0 } : false}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ delay: i * 0.04, type: "spring", visualDuration: 0.35, bounce: 0.3 }}
            className={`h-2 flex-1 rounded-full ${i < have ? "bg-mint-pop" : "border-[1.5px] border-ember bg-transparent"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Clock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v4l2.5 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function People({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="7.5" cy="7" r="2.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 16c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 4.6a2.6 2.6 0 0 1 0 4.9M14.6 11.9c1.5.5 2.5 1.8 2.9 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
