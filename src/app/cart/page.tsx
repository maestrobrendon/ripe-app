"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";

export default function CartPage() {
  const cart = useCart();
  const delivery = quoteDelivery(cart.subtotal, cart.isSubscriber);
  const total = cart.subtotal + delivery.fee;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10 sm:px-6">
      <h1 className="text-2xl font-semibold sm:text-3xl">Your cart</h1>

      {cart.items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Your cart is empty.{" "}
          <Link href="/shop" className="text-ripe-green underline">Start shopping</Link>.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:gap-8 lg:grid-cols-[1fr_320px]">
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
                cloudinaryPublicId: item.cloudinaryPublicId,
                memberPrice: item.memberPrice,
                standardPrice: item.standardPrice,
              };
              return (
                <li key={item.productId} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:gap-4 sm:p-4">
                  <ProductImage
                    publicId={item.cloudinaryPublicId}
                    alt={item.name}
                    emoji={item.imageEmoji}
                    className="h-14 w-14 shrink-0"
                    rounded="rounded-xl"
                    emojiClassName="text-2xl"
                    sizes="56px"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-sm text-muted">{item.unit} · {formatNaira(price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border"
                      onClick={() => cart.setQuantity(addable, item.quantity - item.stepQty)}
                      aria-label={`Reduce ${item.name}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border"
                      onClick={() => cart.setQuantity(addable, item.quantity + item.stepQty)}
                      aria-label={`Add ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                  <p className="ml-auto w-20 shrink-0 text-right text-sm font-medium sm:ml-0">
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

            {!delivery.isFree && (
              <p className="mt-4 text-xs text-muted">
                Add {formatNaira(delivery.toFreeDelivery)} more for free delivery.
              </p>
            )}

            <Link
              href="/checkout"
              className="mt-4 block rounded-full bg-ripe-terracotta px-6 py-3 text-center text-sm font-medium text-white hover:bg-ripe-terracotta-dark"
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
