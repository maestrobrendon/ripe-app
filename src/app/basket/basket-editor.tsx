"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DeliveryDaySelect } from "@/components/delivery-day-select";
import { formatNaira } from "@/lib/format";
import { setBasketItemQuantity, setBasketDeliveryDay, setWindowSkipped } from "./actions";
import type { DeliveryDay } from "@/generated/prisma/enums";

type Item = {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  stepQty: number;
  imageEmoji: string;
  memberPrice: number;
  standardPrice: number;
  quantity: number;
};

type Recommended = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  minOrderQty: number;
  imageEmoji: string;
  memberPrice: number;
  standardPrice: number;
};

export function BasketEditor({
  items,
  deliveryDay,
  locked,
  skipped,
  recommended,
}: {
  items: Item[];
  deliveryDay: DeliveryDay;
  locked: boolean;
  skipped: boolean;
  recommended: Recommended[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const suggestions = recommended.filter((r) => !items.some((i) => i.productId === r.id));

  return (
    <div className="space-y-8">
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
          className={`rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
            skipped
              ? "border-ripe-terracotta bg-ripe-terracotta-light text-ripe-terracotta-dark"
              : "border-border hover:bg-ripe-green-light"
          }`}
        >
          {skipped ? "Skipped. Undo" : "Skip this week"}
        </button>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">In your basket</h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Your basket is empty. Add items from the suggestions below, or from the shop.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center gap-4 p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ripe-green-light text-3xl">
                  {item.imageEmoji}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted">{item.unit} · {formatNaira(item.memberPrice)} member</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={isPending || locked}
                    className="h-8 w-8 rounded-full border border-border disabled:opacity-40"
                    onClick={() => run(() => setBasketItemQuantity(item.productId, item.quantity - item.stepQty))}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    disabled={isPending || locked}
                    className="h-8 w-8 rounded-full border border-border disabled:opacity-40"
                    onClick={() => run(() => setBasketItemQuantity(item.productId, item.quantity + item.stepQty))}
                  >
                    +
                  </button>
                </div>
                <p className="w-20 shrink-0 text-right text-sm font-medium">
                  {formatNaira(item.memberPrice * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!locked && suggestions.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-medium">In season. Add to your basket</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {suggestions.slice(0, 9).map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-ripe-green-light text-3xl">
                  {p.imageEmoji}
                </div>
                <p className="font-medium">{p.name}</p>
                <p className="mb-2 text-xs text-muted">{formatNaira(p.memberPrice)}</p>
                <button
                  disabled={isPending}
                  onClick={() => run(() => setBasketItemQuantity(p.id, p.minOrderQty))}
                  className="w-full rounded-full border border-ripe-green py-1.5 text-xs font-medium text-ripe-green hover:bg-ripe-green-light disabled:opacity-60"
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
