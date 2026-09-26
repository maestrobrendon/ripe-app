"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import type { StreakView } from "@/lib/streak-config";
import { IdeasDesktopPanel } from "./ideas-desktop-panel";
import { setBasketItemQuantity, setWindowSkipped, swapBasketItem, restoreLastWeek } from "./actions";
import { Icon } from "@/components/ui/icon";

export type BasketLine = {
  productId: string;
  name: string;
  unit: string;
  inSeason: boolean;
  stepQty: number;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  memberPrice: number;
  standardPrice: number;
  quantity: number;
};

export type QuickAddItem = {
  id: string;
  name: string;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  minOrderQty: number;
};

export type Flagged = {
  productId: string;
  reason: string;
  swapToId: string;
  swapToName: string;
  swapToEmoji: string;
};

export function BasketWorkspace({
  items,
  isSubscriber,
  locked,
  skipped,
  streak,
  memberSubtotal,
  standardSubtotal,
  savings,
  goalFit,
  quickAdd,
  flagged,
  canRestore,
  signature,
}: {
  items: BasketLine[];
  isSubscriber: boolean;
  locked: boolean;
  skipped: boolean;
  streak: StreakView;
  memberSubtotal: number;
  standardSubtotal: number;
  savings: number;
  goalFit: string | null;
  quickAdd: QuickAddItem[];
  flagged: Flagged[];
  canRestore: boolean;
  signature: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const editable = !locked && !skipped;
  const flaggedMap = new Map(flagged.map((f) => [f.productId, f]));
  const priceOf = (l: BasketLine) => (isSubscriber ? l.memberPrice : l.standardPrice);
  const runningValue = isSubscriber ? memberSubtotal : standardSubtotal;

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Subscriber-only skip toggle. Ship day itself lives in the status card and bottom bar. */}
        {isSubscriber && (
          <div className="flex justify-end">
            <button
              disabled={isPending || locked}
              onClick={() => run(() => setWindowSkipped(!skipped))}
              className={`tap-target rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                skipped ? "border-border bg-ember/12 text-carbon" : "border-border hover:bg-sky-wash"
              }`}
            >
              {skipped ? "Skipped. Undo" : "Skip this week"}
            </button>
          </div>
        )}

        {/* Same as last week + quick add shelf. The chip row fades at both edges
            and scrolls flush from the container edge, per the mobile pass. */}
        {editable && (canRestore || quickAdd.length > 0) && (
          <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
            {canRestore && (
              <button
                disabled={isPending}
                onClick={() => run(restoreLastWeek)}
                className="tap-target rounded-full bg-carbon px-4 py-2 text-sm font-medium text-white hover:bg-carbon/85 disabled:opacity-60"
              >
                Same as last time
              </button>
            )}
            {quickAdd.length > 0 && (
              <div className={canRestore ? "mt-3" : ""}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Quick add</p>
                <div
                  className="snap-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
                  style={{
                    maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
                  }}
                >
                  {quickAdd.map((q) => (
                    <button
                      key={q.id}
                      disabled={isPending}
                      onClick={() => run(() => setBasketItemQuantity(q.id, q.minOrderQty))}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-border py-1.5 pl-1.5 pr-3 text-xs font-medium hover:bg-sky-wash disabled:opacity-60"
                    >
                      <ProductImage
                        publicId={q.cloudinaryPublicId}
                        alt={q.name}
                        emoji={q.imageEmoji}
                        className="h-6 w-6"
                        rounded="rounded-full"
                        emojiClassName="text-sm"
                        sizes="24px"
                      />
                      {q.name} +
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Basket items */}
        <div>
          <h2 className="mb-3 text-lg font-medium">In your basket</h2>
          {items.length === 0 ? (
            <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
              Your basket is empty. Ideas has a starter set ready to add.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border bg-surface shadow-sm">
              {items.map((item) => {
                const flag = flaggedMap.get(item.productId);
                // At quantity 1 the unit price and the line total are the same
                // number: showing it on both sides of the row reads like a
                // double charge, so it appears once, on the right, until the
                // quantity actually makes the multiplication worth showing.
                const unitLine =
                  item.quantity === 1
                    ? item.unit
                    : `${item.unit} · ${formatNaira(priceOf(item))}${isSubscriber ? " member" : ""}`;
                return (
                  <li key={item.productId} className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <ProductImage
                        publicId={item.cloudinaryPublicId}
                        alt={item.name}
                        emoji={item.imageEmoji}
                        className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
                        rounded="rounded-xl"
                        emojiClassName="text-2xl sm:text-3xl"
                        sizes="56px"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="text-sm text-muted">{unitLine}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={isPending || !editable}
                          className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
                          onClick={() =>
                            run(() => setBasketItemQuantity(item.productId, item.quantity - item.stepQty))
                          }
                        >
                          <Icon name="minus" size={16} />
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          disabled={isPending || !editable}
                          className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
                          onClick={() =>
                            run(() => setBasketItemQuantity(item.productId, item.quantity + item.stepQty))
                          }
                        >
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                      <p className="w-16 shrink-0 text-right text-sm font-medium sm:w-20">
                        {formatNaira(priceOf(item) * item.quantity)}
                      </p>
                    </div>

                    {flag && editable && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-input border border-border bg-ember/12 p-2 text-xs">
                        <span className="text-carbon">{flag.reason}.</span>
                        <button
                          disabled={isPending}
                          onClick={() => run(() => swapBasketItem(flag.productId, flag.swapToId))}
                          className="rounded-full border border-carbon px-3 py-1 font-medium text-carbon hover:bg-sky-wash disabled:opacity-60"
                        >
                          Swap for {flag.swapToEmoji} {flag.swapToName}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Running value</span>
              <span className="text-lg font-semibold">{formatNaira(runningValue)}</span>
            </div>
            {isSubscriber && savings > 0 && (
              <p className="text-xs text-carbon">
                Saving {formatNaira(savings)} on this basket vs non-member pricing
              </p>
            )}
            {isSubscriber && goalFit && (
              <p className="mt-1 inline-flex w-fit rounded-full bg-sky-wash px-3 py-1 text-xs font-medium text-carbon">
                {goalFit}
              </p>
            )}
          </div>
        </div>
      </div>

      <IdeasDesktopPanel signature={signature} locked={!editable} streak={streak} showStreak={isSubscriber} />
    </div>
  );
}
