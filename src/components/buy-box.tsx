"use client";

import { useState, useTransition } from "react";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { formatNaira } from "@/lib/format";
import { BASE_DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { addToStandingBasket } from "@/app/basket/actions";

type Mode = "one-time" | "subscribe";

export function BuyBox({
  product,
  name,
  inSeason,
  isSubscriber,
}: {
  product: AddableProduct;
  name: string;
  inSeason: boolean;
  isSubscriber: boolean;
}) {
  const cart = useCart();
  const [qty, setQty] = useState(product.minOrderQty);
  const [mode, setMode] = useState<Mode>("one-time");
  const [frequency, setFrequency] = useState<1 | 2>(1);
  const [isPending, startTransition] = useTransition();

  const hasMemberSaving = product.memberPrice < product.standardPrice;
  const savePct = Math.max(
    0,
    Math.round((1 - product.memberPrice / product.standardPrice) * 100),
  );
  // Lead with the member price when it is lower, standard struck through beside it.
  const headlinePrice = hasMemberSaving ? product.memberPrice : product.standardPrice;

  const step = product.stepQty;
  const dec = () => setQty((q) => Math.max(product.minOrderQty, q - step));
  const inc = () => setQty((q) => q + step);

  const addOneTime = () => {
    const existing = cart.items.find((i) => i.productId === product.id)?.quantity ?? 0;
    cart.setQuantity(product, existing + qty);
  };

  const subscribeLabel = !isSubscriber ? "Subscribe to add" : "Add to standing basket";

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ripe-green">
        Freshly selected · Ripe quality checked
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{name}</h1>

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        {hasMemberSaving && (
          <span className="text-base text-muted line-through">{formatNaira(product.standardPrice)}</span>
        )}
        <span className="text-2xl font-semibold">{formatNaira(headlinePrice)}</span>
        {hasMemberSaving && (
          <span className="rounded-full bg-ripe-green-light px-2 py-0.5 text-xs font-medium text-ripe-green">
            member price
          </span>
        )}
      </div>
      {hasMemberSaving && !isSubscriber && (
        <p className="mt-1 text-xs text-muted">
          {mode === "subscribe"
            ? "You pay the member price on every delivery."
            : `One-time price today is ${formatNaira(product.standardPrice)}. Subscribe to pay the member price.`}
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        <span className="underline">Delivery</span> calculated at checkout.
      </p>

      {/* Quantity */}
      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-muted">Quantity</p>
        <div className="flex w-fit items-center gap-1 rounded-full border border-border px-1">
          <button onClick={dec} className="h-9 w-9 rounded-full text-lg" aria-label="Reduce quantity">
            −
          </button>
          <span className="w-10 text-center text-sm">{qty}</span>
          <button onClick={inc} className="h-9 w-9 rounded-full text-lg" aria-label="Increase quantity">
            +
          </button>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-4">
        {mode === "one-time" ? (
          <button
            onClick={addOneTime}
            className="w-full rounded-full bg-ripe-green px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-white hover:bg-ripe-green-dark"
          >
            Add to cart
          </button>
        ) : (
          <button
            onClick={() => startTransition(() => addToStandingBasket(product.id, qty, frequency))}
            disabled={isPending}
            className="w-full rounded-full bg-ripe-green px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-white hover:bg-ripe-green-dark disabled:opacity-60"
          >
            {isPending ? "Adding." : subscribeLabel}
          </button>
        )}
      </div>

      {/* Stock */}
      <p className="mt-3 flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${inSeason ? "bg-ripe-green" : "bg-ripe-terracotta"}`} />
        {inSeason ? "In stock" : "Limited this season"}
      </p>

      {/* Trust badges, numbers from the delivery-fee config */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-[11px] text-muted">
        <span>Handpicked &amp; quality checked</span>
        <span>
          Delivery from {formatNaira(BASE_DELIVERY_FEE)}, free over {formatNaira(FREE_DELIVERY_THRESHOLD)}
        </span>
        <span>Freshness guaranteed</span>
      </div>

      {/* Purchase mode */}
      <div className="mt-5 overflow-hidden rounded-xl border border-border text-sm">
        <label className="flex cursor-pointer items-center gap-2 border-b border-border p-3 has-[:checked]:bg-ripe-green-light">
          <input
            type="radio"
            name="mode"
            checked={mode === "one-time"}
            onChange={() => setMode("one-time")}
          />
          One-time purchase
        </label>
        <div className="p-3 has-[:checked]:bg-ripe-green-light">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "subscribe"}
                onChange={() => setMode("subscribe")}
              />
              Subscribe &amp; save{savePct > 0 ? ` ${savePct}%` : ""}
            </span>
          </label>
          {mode === "subscribe" && (
            <div className="mt-2 space-y-1 pl-6 text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="freq"
                  checked={frequency === 1}
                  onChange={() => setFrequency(1)}
                />
                Deliver every week
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="freq"
                  checked={frequency === 2}
                  onChange={() => setFrequency(2)}
                />
                Deliver every 2 weeks
              </label>
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Auto-renews. Skip or cancel anytime.</p>
    </div>
  );
}
