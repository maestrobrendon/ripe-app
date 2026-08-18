"use client";

import Link from "next/link";
import { useBasket } from "@/components/basket-provider";
import { formatNaira, DELIVERY_DAY_LABEL } from "@/lib/format";

export function BasketDrawer() {
  const basket = useBasket();

  if (!basket.isOpen) return null;

  const savings = basket.marketSubtotal - basket.memberSubtotal;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close basket"
        onClick={basket.closeDrawer}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Your basket</h2>
          <button onClick={basket.closeDrawer} className="text-muted hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {basket.items.length === 0 ? (
            <p className="text-sm text-muted">Nothing in your basket yet. Add produce from the shop.</p>
          ) : (
            <ul className="space-y-4">
              {basket.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ripe-green-light text-2xl">
                    {item.imageEmoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted">{item.unit} · {formatNaira(item.memberPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="h-7 w-7 rounded-full border border-border text-sm"
                      onClick={() =>
                        basket.setQuantity(
                          { id: item.productId, slug: item.slug, name: item.name, unit: item.unit, imageEmoji: item.imageEmoji, memberPrice: item.memberPrice, marketPrice: item.marketPrice },
                          item.quantity - 1
                        )
                      }
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                    <button
                      className="h-7 w-7 rounded-full border border-border text-sm"
                      onClick={() =>
                        basket.setQuantity(
                          { id: item.productId, slug: item.slug, name: item.name, unit: item.unit, imageEmoji: item.imageEmoji, memberPrice: item.memberPrice, marketPrice: item.marketPrice },
                          item.quantity + 1
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          {basket.deliveryDay && (
            <p className="mb-2 text-xs text-muted">
              Delivers {DELIVERY_DAY_LABEL[basket.deliveryDay]}
            </p>
          )}
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted">Market price would be</span>
            <span className="text-muted line-through">{formatNaira(basket.marketSubtotal)}</span>
          </div>
          <div className="mb-3 flex items-center justify-between text-base font-semibold">
            <span>Ripe subtotal</span>
            <span>{formatNaira(basket.memberSubtotal)}</span>
          </div>
          {savings > 0 && (
            <p className="mb-3 text-xs text-ripe-terracotta-dark">
              You&rsquo;re saving {formatNaira(savings)} vs. market price
            </p>
          )}
          <div className="flex gap-2">
            <Link
              href="/basket"
              onClick={basket.closeDrawer}
              className="flex-1 rounded-full border border-ripe-green px-4 py-2.5 text-center text-sm font-medium text-ripe-green hover:bg-ripe-green-light"
            >
              Edit basket
            </Link>
            <Link
              href="/checkout"
              onClick={basket.closeDrawer}
              className="flex-1 rounded-full bg-ripe-terracotta px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-ripe-terracotta-dark"
            >
              Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
