"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import { useDestination } from "@/components/destination-provider";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { Icon } from "@/components/ui/icon";
import { HomeCartTabs } from "@/components/home-cart-tabs";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { GetIdeasChat } from "@/components/get-ideas-chat";

export default function CartPage() {
  const cart = useCart();
  const { signedIn } = useDestination();
  const [ideasOpen, setIdeasOpen] = useState(false);
  const delivery = quoteDelivery(cart.subtotal, cart.isSubscriber);
  const total = cart.subtotal + delivery.fee;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10 sm:px-6">
      {/* "/" rather than "/basket" directly: a guest can reach this cart with
          no account, and "/" already sends a signed-in visitor to "/basket"
          on its own without forcing a login redirect on a guest here. */}
      <HomeCartTabs homeHref="/" />

      <h1 className="text-2xl font-semibold sm:text-3xl">Your cart</h1>

      {cart.items.length === 0 ? (
        <p className="mt-6 rounded-card border border-dashed border-border p-8 text-center text-sm text-muted">
          Your cart is empty.{" "}
          <Link href="/shop" className="text-carbon underline">Start shopping</Link>.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="min-w-0 divide-y divide-border rounded-card border border-border bg-surface">
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
                      <Icon name="minus" size={16} />
                    </button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button
                      className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-border"
                      onClick={() => cart.setQuantity(addable, item.quantity + item.stepQty)}
                      aria-label={`Add ${item.name}`}
                    >
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                  <p className="ml-auto w-20 shrink-0 text-right text-sm font-medium sm:ml-0">
                    {formatNaira(price * item.quantity)}
                  </p>
                </li>
              );
            })}
          </ul>

          <div className="h-fit rounded-card border border-border bg-surface p-5 text-sm">
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
              <p className="mt-3 text-xs text-carbon">
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
              className="mt-4 block rounded-full bg-carbon px-6 py-3 text-center text-sm font-medium text-white hover:bg-carbon/85"
            >
              Continue to checkout
            </Link>
            {signedIn ? (
              <button
                type="button"
                onClick={() => setIdeasOpen(true)}
                className="mt-3 block w-full text-center text-xs font-medium text-carbon underline"
              >
                Get ideas for what to make
              </button>
            ) : (
              <Link href="/recipes" className="mt-3 block text-center text-xs font-medium text-carbon underline">
                Get ideas for what to make
              </Link>
            )}
          </div>
        </div>
      )}

      <BottomSheet open={ideasOpen} onClose={() => setIdeasOpen(false)} title="Get ideas">
        <GetIdeasChat
          source="CART_SHEET"
          starters={[
            "What am I missing for Saturday's recipe?",
            "Suggest a quick dinner from what's in my cart",
            "Help me round out this order",
          ]}
        />
      </BottomSheet>
    </div>
  );
}
