"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
import { formatNaira } from "@/lib/format";
import type { StarterCandidate } from "@/lib/starter-basket-core";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductImage } from "@/components/product-image";
import { RollingNumber } from "@/components/ui/rolling-number";
import { Icon } from "@/components/ui/icon";
import { shortName } from "../home-menu/parts/shared";
import { snapQuantity } from "./recipe-basket";
import { QtyStepper } from "./start-flow";

/*
 * "Create your own basket", inside sign-up: the whole fruit and veg range in
 * one quick list, for this first basket only (never the site's cart). It
 * opens on what's already in the basket, so recipe items can be kept, changed
 * or cleared; nothing changes until Save.
 */

type Shelf = "all" | "FRUIT" | "VEGETABLE" | "SEASONAL";
const SHELVES: [Shelf, string][] = [
  ["all", "Everything"],
  ["FRUIT", "Fruit"],
  ["VEGETABLE", "Vegetables"],
  ["SEASONAL", "In season"],
];

export function OwnBasketSheet({
  open,
  onClose,
  candidates,
  current,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  candidates: StarterCandidate[];
  /** What's in the basket now, by product id. */
  current: Record<string, number>;
  onSave: (next: Record<string, number>) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Create your own basket" desktopDialog>
      {/* Mounted per opening, so it always starts from the basket as it is. */}
      {open && <Picker candidates={candidates} current={current} onSave={onSave} />}
    </BottomSheet>
  );
}

function Picker({ candidates, current, onSave }: { candidates: StarterCandidate[]; current: Record<string, number>; onSave: (next: Record<string, number>) => void }) {
  const [draft, setDraft] = useState<Record<string, number>>(current);
  const [shelf, setShelf] = useState<Shelf>("all");
  const [query, setQuery] = useState("");

  // In season first, then A to Z; the order never moves while you add.
  const range = candidates.filter((c) => c.category !== "BOX_BUNDLE").sort((a, b) => Number(b.inSeason) - Number(a.inSeason) || a.name.localeCompare(b.name));
  const q = query.trim().toLowerCase();
  const shown = range.filter((c) => (shelf === "all" || (shelf === "SEASONAL" ? c.inSeason || c.category === "SEASONAL" : c.category === shelf)) && (!q || c.name.toLowerCase().includes(q)));

  const picked = range.filter((c) => (draft[c.id] ?? 0) > 0);
  const total = picked.reduce((s, c) => s + c.standardPrice * draft[c.id], 0);
  const set = (id: string, n: number) => {
    haptic("selection");
    setDraft((d) => ({ ...d, [id]: n }));
  };

  return (
    <div className="-mx-5 lg:-mx-6">
      <div className="px-5 lg:px-6">
        <p className="text-[14px] text-(--hm-ink-2,#6b6b6b)">Pick what you like. It only changes this basket.</p>
        <label className="mt-3 flex h-11 items-center gap-2 rounded-full bg-(--hm-tint,#f2f3ee) px-4">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search fruit and veg" aria-label="Search fruit and veg" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-(--hm-ink-3,#9a9a9a)" />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Show">
          {SHELVES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={shelf === id}
              onClick={() => setShelf(id)}
              className={`h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${shelf === id ? "bg-carbon text-paper-white" : "bg-(--hm-tint,#f2f3ee)"}`}
            >
              {label}
            </button>
          ))}
          {picked.length > 0 && (
            <button type="button" onClick={() => (haptic("light"), setDraft({}))} className="ml-auto h-9 shrink-0 px-2 text-[13px] text-(--hm-ink-3,#9a9a9a) underline underline-offset-4">
              Start empty
            </button>
          )}
        </div>
      </div>

      <ul className="mt-2 px-5 lg:px-6">
        {shown.map((c) => {
          const n = draft[c.id] ?? 0;
          return (
            <li key={c.id} className="flex items-center gap-3 border-b border-(--hm-line,#ececec) py-2.5 last:border-0">
              <ProductImage publicId={c.cloudinaryPublicId} alt="" emoji={c.imageEmoji} sizes="44px" rounded="rounded-[12px]" flavour="bg-(--hm-tint)" emojiClassName="text-xl" className="h-11 w-11 shrink-0" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-semibold">{shortName(c.name)}</b>
                <small className="text-[13px] text-(--hm-ink-3,#9a9a9a) tabular-nums">{formatNaira(c.standardPrice)}</small>
              </span>
              {n > 0 ? (
                <QtyStepper label={shortName(c.name)} value={n} onLess={() => set(c.id, n <= c.minOrderQty ? 0 : n - c.stepQty)} onMore={() => set(c.id, snapQuantity(n + c.stepQty, c.minOrderQty, c.stepQty))} />
              ) : (
                <motion.button whileTap={{ scale: press.scale }} transition={spring.snappy} type="button" onClick={() => set(c.id, c.minOrderQty)} aria-label={`Add ${shortName(c.name)}`} className="h-9 rounded-full bg-carbon px-4 text-[13px] font-semibold text-paper-white">
                  Add
                </motion.button>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-8 text-center text-[14px] text-(--hm-ink-3,#9a9a9a)">Nothing called that. Try another name.</li>}
      </ul>

      {/* Save stays under the thumb while the list scrolls. */}
      <div className="sticky bottom-0 bg-linear-to-t from-paper-white from-75% to-paper-white/0 px-5 pt-5 pb-1 lg:px-6">
        <motion.button
          type="button"
          whileTap={{ scale: press.scale }}
          transition={spring.snappy}
          disabled={picked.length === 0}
          onClick={() => onSave(draft)}
          className="flex h-14 w-full items-center justify-center gap-1.5 rounded-full bg-carbon text-[16px] font-semibold text-paper-white transition-opacity disabled:opacity-30"
        >
          {picked.length === 0 ? (
            "Add something to save"
          ) : (
            <>
              Save my basket · {picked.length} {picked.length === 1 ? "item" : "items"}, <RollingNumber value={total} format={formatNaira} />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
