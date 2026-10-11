"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { weekShoppingList, addShoppingListItems, toggleElsewhereGot } from "./meal-plan-actions";

type WeSellLine = {
  productId: string;
  name: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  standardPrice: number;
  memberPrice: number;
  mealCount: number;
  haveIt: boolean;
};
type ElsewhereLine = { term: string; mealCount: number; got: boolean };

/**
 * Everything the week's timetable needs, built fresh each time it's opened:
 * "We can bring these" (add the gaps to cart or basket) and "Get these
 * elsewhere" (a tick-off checklist only — we don't stock it).
 */
export function ShoppingListSheet({
  open,
  onClose,
  weekOffset,
}: {
  open: boolean;
  onClose: () => void;
  weekOffset: number;
}) {
  const router = useRouter();
  const [weSell, setWeSell] = useState<WeSellLine[]>([]);
  const [elsewhere, setElsewhere] = useState<ElsewhereLine[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, startLoading] = useTransition();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const data = await weekShoppingList(weekOffset);
      setWeSell(data.weSell);
      setElsewhere(data.elsewhere);
      setSelected(new Set(data.weSell.filter((l) => !l.haveIt).map((l) => l.productId)));
    });
  }, [open, weekOffset]);

  const toggleSelected = (productId: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });

  const addTo = (destination: "cart" | "basket") =>
    startTransition(async () => {
      await addShoppingListItems(Array.from(selected), destination);
      onClose();
      router.refresh();
    });

  const cost = weSell.filter((l) => selected.has(l.productId)).reduce((s, l) => s + l.memberPrice, 0);

  return (
    <BottomSheet open={open} onClose={onClose} title="Shopping list">
      <p className="text-sm text-muted">Everything your timetable needs this week.</p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Building your list…</p>
      ) : (
        <>
          {weSell.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">We can bring these</p>
              <div className="divide-y divide-border">
                {weSell.map((l) => (
                  <button
                    key={l.productId}
                    disabled={l.haveIt}
                    onClick={() => toggleSelected(l.productId)}
                    className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-50"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        l.haveIt || selected.has(l.productId) ? "border-carbon bg-carbon text-white" : "border-border"
                      }`}
                    >
                      {(l.haveIt || selected.has(l.productId)) && <Icon name="checkPlain" size={13} />}
                    </span>
                    <ProductImage
                      publicId={l.cloudinaryPublicId}
                      alt={l.name}
                      emoji={l.imageEmoji}
                      className="h-9 w-9 shrink-0"
                      rounded="rounded-lg"
                      emojiClassName="text-lg"
                      sizes="36px"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.name}</span>
                      <span className="block text-xs text-muted">
                        {l.haveIt ? "You have this" : `For ${l.mealCount} meal${l.mealCount > 1 ? "s" : ""}`}
                      </span>
                    </span>
                    {!l.haveIt && <span className="shrink-0 text-sm font-medium">{formatNaira(l.memberPrice)}</span>}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  disabled={isPending || selected.size === 0}
                  onClick={() => addTo("cart")}
                  className="flex-1 rounded-full border border-border py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Add {selected.size} to cart
                </button>
                <button
                  disabled={isPending || selected.size === 0}
                  onClick={() => addTo("basket")}
                  className="flex-1 rounded-full bg-carbon py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add to basket · {formatNaira(cost)}
                </button>
              </div>
            </div>
          )}

          {elsewhere.length > 0 && (
            <div className="mt-6">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Get these elsewhere</p>
              <p className="mb-2 text-sm text-muted">We don&rsquo;t sell these yet. Tick them off as you shop.</p>
              <div className="divide-y divide-border">
                {elsewhere.map((l) => (
                  <button
                    key={l.term}
                    onClick={() => startTransition(() => toggleElsewhereGot(weekOffset, l.term))}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        l.got ? "border-carbon bg-carbon text-white" : "border-border"
                      }`}
                    >
                      {l.got && <Icon name="checkPlain" size={13} />}
                    </span>
                    <span className={`flex-1 text-sm font-medium capitalize ${l.got ? "text-muted line-through" : ""}`}>
                      {l.term}
                    </span>
                    <span className="text-xs text-muted">
                      For {l.mealCount} meal{l.mealCount > 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {weSell.length === 0 && elsewhere.length === 0 && (
            <p className="mt-6 text-sm text-muted">Add a meal to your timetable to build a shopping list.</p>
          )}
        </>
      )}
    </BottomSheet>
  );
}
