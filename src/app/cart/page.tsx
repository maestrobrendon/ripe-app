"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { formatNaira } from "@/lib/format";
import { ORDER_MINIMUM, quoteDelivery, checkMinimum } from "@/lib/pricing";

export default function CartPage() {
  const cart = useCart();
  const { meetsMinimum, shortfall } = checkMinimum(cart.subtotal);
  const delivery = quoteDelivery(cart.subtotal, cart.isSubscriber);
  const total = cart.subtotal + delivery.fee;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Your cart</h1>

      {cart.items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Your cart is empty.{" "}
          <Link href="/shop" className="text-ripe-green underline">Start shopping</Link>.
        </p>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {cart.items.map((item) => {
              const price = cart.isSubscriber ? item.memberPrice : item.standardPrice;
              const addable = {
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
              return (
                <li key={item.productId} className="flex items-center gap-4 p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ripe-green-light text-3xl">
                    {item.imageEmoji}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted">{item.unit} · {formatNaira(price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="h-8 w-8 rounded-full border border-border"
                      onClick={() => cart.setQuantity(addable, item.quantity - item.stepQty)}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      className="h-8 w-8 rounded-full border border-border"
                      onClick={() => cart.setQuantity(addable, item.quantity + item.stepQty)}
                    >
                      +
                    </button>
                  </div>
                  <p className="w-20 shrink-0 text-right text-sm font-medium">
                    {formatNaira(price * item.quantity)}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="h-fit rounded-2xl border border-border bg-surface p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span>{formatNaira(cart.subtotal)}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted">Delivery</span>
              <span>{delivery.isFree ? "Free" : formatNaira(delivery.fee)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatNaira(total)}</span>
            </div>

            {!cart.isSubscriber && cart.savingsIfMember > 0 && (
              <p className="mt-3 text-xs text-ripe-terracotta-dark">
                Members would pay {formatNaira(cart.memberSubtotal)} for this cart.{" "}
                <Link href="/subscribe" className="underline">See subscription</Link>
              </p>
            )}

            {!meetsMinimum ? (
              <p className="mt-4 rounded-lg bg-ripe-terracotta-light p-3 text-xs text-ripe-terracotta-dark">
                Orders start at {formatNaira(ORDER_MINIMUM)}. Add {formatNaira(shortfall)} more to check out.
              </p>
            ) : !delivery.isFree ? (
              <p className="mt-4 text-xs text-muted">
                Add {formatNaira(delivery.toFreeDelivery)} more for free delivery.
              </p>
            ) : null}

            <Link
              href="/checkout"
              aria-disabled={!meetsMinimum}
              className={`mt-4 block rounded-full px-6 py-3 text-center text-sm font-medium text-white ${
                meetsMinimum
                  ? "bg-ripe-terracotta hover:bg-ripe-terracotta-dark"
                  : "pointer-events-none bg-ripe-terracotta/40"
              }`}
            >
              Continue to checkout
            </Link>
            <Link href="/recipes" className="mt-3 block text-center text-xs font-medium text-ripe-green underline">
              Ask the trained assistant what to make
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
