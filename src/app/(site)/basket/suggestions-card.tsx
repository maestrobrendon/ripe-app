"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import type { ProductCardData } from "@/components/product-card";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { press, spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";

export type Suggestion = { product: ProductCardData; reason: string };

/** "per pawpaw" reads as "pawpaw" after the slash; "piece" and "each" read as "each". */
function unitWord(unit: string) {
  const u = unit.replace(/^per\s+/i, "").trim();
  return !u || /^(piece|each)$/i.test(u) ? "each" : u;
}

/**
 * What to add next, as a short list with a reason on every line ("You order
 * this most", "In season now"), so it reads as advice rather than a shelf.
 * × puts a line away for now; + adds it to the basket. The rows arrive one
 * after another, after the hero above has settled.
 */
export function SuggestionsCard({ title, suggestions }: { title: string; suggestions: Suggestion[] }) {
  const cart = useCart();
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState<string[]>([]);
  const rows = suggestions.filter((s) => !hidden.includes(s.product.id));
  if (rows.length === 0) return null;

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.smooth, delay: 0.2 }}
      data-track-section="basket-suggestions"
      className="mt-5 rounded-[26px] bg-surface px-4 pt-4 pb-2 ring-1 ring-hairline sm:px-5 sm:pt-5"
      aria-label={title}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        <Link href="/shop" className="text-[14px] font-semibold text-[#0f7a48]">
          See more
        </Link>
      </div>
      <ul className="mt-1.5">
        <AnimatePresence initial={false}>
          {rows.map((s, i) => {
            const inBasket = cart.quantityOf(s.product.id) > 0;
            return (
              <motion.li
                key={s.product.id}
                layout
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24, height: 0, transition: spring.snappy }}
                transition={{ ...spring.smooth, delay: reduced ? 0 : 0.35 + i * 0.07 }}
                className="flex items-center gap-3 py-2.5"
              >
                <ProductImage publicId={s.product.cloudinaryPublicId} alt="" emoji={s.product.imageEmoji} sizes="44px" rounded="rounded-[14px]" flavour="bg-soft-mist" emojiClassName="text-[22px]" className="h-11 w-11 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <b className="truncate text-[15px] font-semibold">{s.product.name}</b>
                    <small className="shrink-0 text-[12px] text-muted">/ {unitWord(s.product.unit)}</small>
                  </span>
                  <small className="block truncate text-[13px] text-muted">{s.reason}</small>
                </span>
                <motion.button
                  type="button"
                  whileTap={{ scale: press.scale }}
                  aria-label={`Not now: ${s.product.name}`}
                  onClick={() => {
                    haptic("selection");
                    setHidden((h) => [...h, s.product.id]);
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft-mist text-carbon/70"
                >
                  <Icon name="close" size={14} weight="bold" />
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: press.scale }}
                  disabled={inBasket}
                  aria-label={inBasket ? `${s.product.name} is in your basket` : `Add ${s.product.name}`}
                  onClick={() => {
                    haptic("success");
                    void cart.setQuantity(s.product, Math.max(1, s.product.minOrderQty));
                  }}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${inBasket ? "bg-mint-pop/40 text-[#0f7a48]" : "bg-mint-pop text-carbon"}`}
                >
                  <Icon name={inBasket ? "checkPlain" : "plus"} size={15} weight="bold" />
                </motion.button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}
