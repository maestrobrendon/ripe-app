"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DeliveryDaySelect } from "@/components/delivery-day-select";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import type { StreakView } from "@/lib/streak-config";
import { AssistantRail } from "./assistant-rail";
import {
  setBasketItemQuantity,
  setBasketDeliveryDay,
  setWindowSkipped,
  swapBasketItem,
  restoreLastWeek,
} from "./actions";
import type { DeliveryDay } from "@/generated/prisma/enums";

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
  locked,
  skipped,
  deliveryDay,
  streak,
  memberSubtotal,
  savings,
  goalFit,
  quickAdd,
  flagged,
  canRestore,
  signature,
}: {
  items: BasketLine[];
  locked: boolean;
  skipped: boolean;
  deliveryDay: DeliveryDay;
  streak: StreakView;
  memberSubtotal: number;
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

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Delivery day + skip */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Delivery day</span>
            <DeliveryDaySelect
              value={deliveryDay}
              onChange={(d) => setBasketDeliveryDay(d).then(() => router.refresh())}
            />
          </div>
          <button
            disabled={isPending || locked}
            onClick={() => run(() => setWindowSkipped(!skipped))}
            className={`tap-target rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
              skipped
                ? "border-ripe-terracotta bg-ripe-terracotta-light text-ripe-terracotta-dark"
                : "border-border hover:bg-ripe-green-light"
            }`}
          >
            {skipped ? "Skipped. Undo" : "Skip this week"}
          </button>
        </div>

        {/* Same as last week + quick add shelf */}
        {editable && (canRestore || quickAdd.length > 0) && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            {canRestore && (
              <button
                disabled={isPending}
                onClick={() => run(restoreLastWeek)}
                className="tap-target rounded-full bg-ripe-green px-4 py-2 text-sm font-medium text-white hover:bg-ripe-green-dark disabled:opacity-60"
              >
                Same as last week
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
                      className="flex shrink-0 items-center gap-2 rounded-full border border-border py-1.5 pl-1.5 pr-3 text-xs font-medium hover:bg-ripe-green-light disabled:opacity-60"
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
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
              Your basket is empty. Use quick add above, or the assistant.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
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
                          {item.unit} · {formatNaira(item.memberPrice)} member
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
                          −
                        </button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          disabled={isPending || !editable}
                          className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
                          onClick={() =>
                            run(() => setBasketItemQuantity(item.productId, item.quantity + item.stepQty))
                          }
                        >
                          +
                        </button>
                      </div>
                      <p className="w-16 shrink-0 text-right text-sm font-medium sm:w-20">
                        {formatNaira(item.memberPrice * item.quantity)}
                      </p>
                    </div>

                    {flag && editable && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-ripe-terracotta-light/50 p-2 text-xs">
                        <span className="text-ripe-terracotta-dark">{flag.reason}.</span>
                        <button
                          disabled={isPending}
                          onClick={() => run(() => swapBasketItem(flag.productId, flag.swapToId))}
                          className="rounded-full border border-ripe-green px-3 py-1 font-medium text-ripe-green hover:bg-ripe-green-light disabled:opacity-60"
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
              <span className="text-lg font-semibold">{formatNaira(memberSubtotal)}</span>
            </div>
            {savings > 0 && (
              <p className="text-xs text-ripe-terracotta-dark">
                Saving {formatNaira(savings)} on this basket vs non-member pricing
              </p>
            )}
            {goalFit && (
              <p className="mt-1 inline-flex w-fit rounded-full bg-ripe-green-light px-3 py-1 text-xs font-medium text-ripe-green">
                {goalFit}
              </p>
            )}
          </div>
        </div>
      </div>

      <AssistantRail signature={signature} locked={!editable} streak={streak} />
    </div>
  );
}
