"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product-image";
import { Check, localName, shortName } from "@/app/(bare)/home-menu/parts/shared";
import { formatQty, type Amount } from "../menu-details";
import type { BasketIngredient, ElsewhereIngredient } from "../recipe-data";

const PANTRY = ["Cooking oil", "Salt", "Black pepper"];

/** 2 and 4 like every meal kit, plus the recipe's own number if it's different. */
function servingOptions(serves: number) {
  return [...new Set([2, 4, serves])].sort((a, b) => a - b);
}

function scaled(amount: Amount | null, factor: number) {
  return amount ? formatQty(amount[0] * factor, amount[1]) : null;
}

/**
 * The ingredient list, split the way Basket's whole pitch works: what comes
 * in the basket (with the catalogue photo), what to pick up elsewhere, and the
 * cupboard basics. A servings switch rescales the amounts, when the recipe
 * has any.
 */
export function Ingredients({
  basket,
  elsewhere,
  serves,
  showHave,
}: {
  basket: BasketIngredient[];
  elsewhere: ElsewhereIngredient[];
  serves: number | null;
  showHave: boolean;
}) {
  const [servings, setServings] = useState(serves ?? 2);
  const hasAmounts = Boolean(serves) && [...basket, ...elsewhere].some((i) => i.amount);
  const factor = serves ? servings / serves : 1;

  return (
    <section aria-labelledby="ingredients-title" className="scroll-mt-28" id="ingredients">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="ingredients-title" className="hm-h3 text-[1.6rem]!">
          Ingredients
        </h2>
        {hasAmounts && serves && (
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-[var(--hm-ink-2)]">Servings</span>
            <div role="radiogroup" aria-label="Servings" className="flex rounded-full bg-[var(--hm-tint)] p-1">
              {servingOptions(serves).map((n) => {
                const on = n === servings;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setServings(n)}
                    className={`h-9 min-w-11 rounded-full px-3 text-[14px] font-semibold transition-colors ${on ? "bg-carbon text-paper-white" : "text-carbon/70 hover:text-carbon"}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold">
          <i className="h-2 w-5 rounded-full bg-mint-pop" aria-hidden />
          Comes in your basket
          <span className="font-normal text-[var(--hm-ink-3)]">{basket.length}</span>
        </h3>
        <ul className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {basket.map(({ product, amount, have }) => {
            const local = localName(product.name);
            const qty = hasAmounts ? scaled(amount, factor) : null;
            return (
              <li key={product.id} className="flex items-center gap-3.5">
                <ProductImage
                  publicId={product.cloudinaryPublicId}
                  alt=""
                  emoji={product.imageEmoji}
                  sizes="56px"
                  rounded="rounded-full"
                  flavour="bg-[var(--hm-tint-2)]"
                  emojiClassName="text-2xl"
                  className="h-14 w-14 shrink-0"
                />
                <div className="min-w-0">
                  {qty && <p className="text-[13px] text-[var(--hm-ink-2)] tabular-nums">{qty}</p>}
                  <p className="text-[15px] leading-snug font-medium">{shortName(product.name)}</p>
                  {local && <p className="text-[13px] text-[var(--hm-ink-3)]">{local}</p>}
                  {showHave && have && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--hm-basket-ink)]">
                      <Check className="h-3.5 w-3.5" /> Already in your basket
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {elsewhere.length > 0 && (
        <div className="mt-8 border-t border-[var(--hm-line)] pt-6">
          <h3 className="flex items-center gap-2.5 text-[15px] font-semibold">
            <i className="h-2 w-5 rounded-full border-[1.5px] border-ember" aria-hidden />
            Grab it elsewhere
          </h3>
          <ul className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {elsewhere.map(({ label, amount }) => {
              const qty = hasAmounts ? scaled(amount, factor) : null;
              return (
                <li key={label} className="flex items-center gap-3.5">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-ember text-[18px] font-semibold text-ember" aria-hidden>
                    {label.charAt(0)}
                  </span>
                  <div>
                    {qty && <p className="text-[13px] text-[var(--hm-ink-2)] tabular-nums">{qty}</p>}
                    <p className="text-[15px] leading-snug font-medium">{label}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-6 rounded-2xl bg-[var(--hm-tint)] px-4 py-3 text-[14px] text-[var(--hm-ink-2)]">
        <b className="font-semibold text-carbon">From your cupboard:</b> {PANTRY.join(", ").toLowerCase()}.
      </p>
    </section>
  );
}
