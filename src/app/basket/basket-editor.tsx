"use client";

import { useBasket, type BasketItemView } from "@/components/basket-provider";
import { DeliveryDaySelect } from "@/components/delivery-day-select";
import { formatNaira } from "@/lib/format";
import { setBasketDeliveryDay } from "./actions";
import type { DeliveryDay } from "@/generated/prisma/enums";

type RecommendedProduct = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  imageEmoji: string;
  memberPrice: number;
  marketPrice: number;
};

export function BasketEditor({
  items: initialItems,
  deliveryDay,
  recommended,
}: {
  items: BasketItemView[];
  deliveryDay: DeliveryDay;
  recommended: RecommendedProduct[];
}) {
  const basket = useBasket();
  const items = basket.items.length > 0 || initialItems.length === 0 ? basket.items : initialItems;

  const handleDayChange = async (day: DeliveryDay) => {
    await setBasketDeliveryDay(day);
    await basket.refresh();
  };

  const suggestions = recommended.filter((r) => !items.some((i) => i.productId === r.id));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
        <span className="text-sm font-medium">Delivery day</span>
        <DeliveryDaySelect value={deliveryDay} onChange={handleDayChange} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">In your basket</h2>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Your basket is empty. Add items from the shop, or from the suggestions below.
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
                  <p className="text-sm text-muted">
                    {item.unit} · {formatNaira(item.memberPrice)} each
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded-full border border-border"
                    onClick={() => basket.setQuantity({ id: item.productId, slug: item.slug, name: item.name, unit: item.unit, imageEmoji: item.imageEmoji, memberPrice: item.memberPrice, marketPrice: item.marketPrice }, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <button
                    className="h-8 w-8 rounded-full border border-border"
                    onClick={() => basket.setQuantity({ id: item.productId, slug: item.slug, name: item.name, unit: item.unit, imageEmoji: item.imageEmoji, memberPrice: item.memberPrice, marketPrice: item.marketPrice }, item.quantity + 1)}
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

      {suggestions.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-medium">Recommended to add</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {suggestions.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-ripe-green-light text-3xl">
                  {p.imageEmoji}
                </div>
                <p className="font-medium">{p.name}</p>
                <p className="mb-2 text-xs text-muted">{formatNaira(p.memberPrice)}</p>
                <button
                  onClick={() => basket.setQuantity(p, 1)}
                  className="w-full rounded-full border border-ripe-green py-1.5 text-xs font-medium text-ripe-green hover:bg-ripe-green-light"
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
