"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";
import type { StreakView } from "@/lib/streak-config";
import { AssistantRail } from "./assistant-rail";
import {
  setBasketItemQuantity,
  setShoppingWindowDay,
  setWindowSkipped,
  swapBasketItem,
  restoreLastWeek,
  checkoutStandingBasket,
} from "./actions";
import type { ShoppingWindowDay } from "@/generated/prisma/enums";
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
  shoppingWindowDay,
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
  shoppingWindowDay: ShoppingWindowDay | null;
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
        {/* Shipping day + (subscriber) skip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Ships</span>
            <select
              defaultValue={shoppingWindowDay ?? ""}
              disabled={isPending}
              onChange={(e) =>
                e.target.value &&
                run(() => setShoppingWindowDay(e.target.value as ShoppingWindowDay))
              }
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
            >
              {!shoppingWindowDay && <option value="">Pick a day</option>}
              {SHOPPING_WINDOW_DAYS.map((d) => (
                <option key={d.day} value={d.day}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          {isSubscriber && (
            <button
              disabled={isPending || locked}
              onClick={() => run(() => setWindowSkipped(!skipped))}
              className={`tap-target rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                skipped
                  ? "border-border bg-ember/12 text-carbon"
                  : "border-border hover:bg-sky-wash"
              }`}
            >
              {skipped ? "Skipped. Undo" : "Skip this week"}
            </button>
          )}
        </div>

        {/* Same as last week + quick add shelf */}
        {editable && (canRestore || quickAdd.length > 0) && (
          <div className="rounded-card border border-border bg-surface p-4">
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
                <div className="snap-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
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
              Your basket is empty. Use quick add above, or the assistant.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border bg-surface">
              {items.map((item) => {
                const flag = flaggedMap.get(item.productId);
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
                        <p className="text-sm text-muted">
                          {item.unit} · {formatNaira(priceOf(item))}
                          {isSubscriber ? " member" : ""}
                        </p>
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

          {items.length > 0 && editable && (
            <div className="mt-5 rounded-card border border-border bg-surface p-4">
              <button
                disabled={isPending || !shoppingWindowDay}
                onClick={() => run(checkoutStandingBasket)}
                className="tap-target w-full rounded-full bg-carbon px-6 py-3 text-sm font-medium text-white hover:bg-carbon/85 disabled:opacity-50"
              >
                Check out this basket
              </button>
              <p className="mt-2 text-center text-xs text-muted">
                {shoppingWindowDay
                  ? "You pay at checkout. Nothing is charged before then."
                  : "Pick a shipping day above to check out."}
              </p>
            </div>
          )}
        </div>
      </div>

      <AssistantRail signature={signature} locked={!editable} streak={streak} showStreak={isSubscriber} />
    </div>
  );
}
