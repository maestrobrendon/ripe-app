"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { formatNaira } from "@/lib/format";
import { ORDER_MINIMUM, quoteDelivery, checkMinimum } from "@/lib/pricing";

export function CartDrawer() {
  const cart = useCart();

  if (!cart.isOpen) return null;

  const { shortfall, meetsMinimum } = checkMinimum(cart.subtotal);
  const delivery = quoteDelivery(cart.subtotal, cart.isSubscriber);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close cart"
        onClick={cart.closeDrawer}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Your cart</h2>
          <button onClick={cart.closeDrawer} className="text-muted hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.items.length === 0 ? (
            <p className="text-sm text-muted">Nothing in your cart yet. Add produce from the shop.</p>
          ) : (
            <ul className="space-y-4">
              {cart.items.map((item) => {
                const price = cart.isSubscriber ? item.memberPrice : item.standardPrice;
                return (
                  <li key={item.productId} className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ripe-green-light text-2xl">
                      {item.imageEmoji}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted">{item.unit} · {formatNaira(price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-7 w-7 rounded-full border border-border text-sm"
                        onClick={() => cart.setQuantity(toAddable(item), item.quantity - item.stepQty)}
                        aria-label={`Reduce ${item.name}`}
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm">{item.quantity}</span>
                      <button
                        className="h-7 w-7 rounded-full border border-border text-sm"
                        onClick={() => cart.setQuantity(toAddable(item), item.quantity + item.stepQty)}
                        aria-label={`Add ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          {!cart.isSubscriber && cart.savingsIfMember > 0 && (
            <p className="mb-2 text-xs text-ripe-terracotta-dark">
              Members would pay {formatNaira(cart.memberSubtotal)} for this cart.{" "}
              <Link href="/subscribe" className="underline" onClick={cart.closeDrawer}>
                see subscription
              </Link>
            </p>
          )}
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span>{formatNaira(cart.subtotal)}</span>
          </div>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted">Delivery</span>
            <span>{delivery.isFree ? "Free" : formatNaira(delivery.fee)}</span>
          </div>

          {!meetsMinimum ? (
            <p className="mb-3 rounded-lg bg-ripe-terracotta-light p-3 text-xs text-ripe-terracotta-dark">
              Orders start at {formatNaira(ORDER_MINIMUM)}. Add {formatNaira(shortfall)} more to check out.
            </p>
          ) : !delivery.isFree ? (
            <p className="mb-3 text-xs text-muted">
              Add {formatNaira(delivery.toFreeDelivery)} more for free delivery.
            </p>
          ) : null}

          <div className="flex gap-2">
            <Link
              href="/cart"
              onClick={cart.closeDrawer}
              className="flex-1 rounded-full border border-ripe-green px-4 py-2.5 text-center text-sm font-medium text-ripe-green hover:bg-ripe-green-light"
            >
              View cart
            </Link>
            <Link
              href="/checkout"
              onClick={cart.closeDrawer}
              aria-disabled={!meetsMinimum}
              className={`flex-1 rounded-full px-4 py-2.5 text-center text-sm font-medium text-white ${
                meetsMinimum
                  ? "bg-ripe-terracotta hover:bg-ripe-terracotta-dark"
                  : "pointer-events-none bg-ripe-terracotta/40"
              }`}
            >
              Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function toAddable(item: ReturnType<typeof useCart>["items"][number]) {
  return {
    id: item.productId,
    slug: item.slug,
    name: item.name,
    unit: item.unit,
    orderUnit: item.orderUnit,
    minOrderQty: item.minOrderQty,
    stepQty: item.stepQty,
    imageEmoji: item.imageEmoji,
    memberPrice: item.memberPrice,
    standardPrice: item.standardPrice,
  };
}
