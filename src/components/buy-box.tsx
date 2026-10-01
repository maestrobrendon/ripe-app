"use client";

import { useRef, useState, useTransition } from "react";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { useDestination } from "@/components/destination-provider";
import { DestinationPill, DestinationOverrideChevron, addToDestination } from "@/components/destination-pill";
import { formatNaira } from "@/lib/format";
import { BASE_DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { addToStandingBasket } from "@/app/basket/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { flyToCart } from "@/components/ui/fly-to-cart";

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
  const dest = useDestination();
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
  const ctaRef = useRef<HTMLButtonElement>(null);

  const addOneTime = async () => {
    if (ctaRef.current) flyToCart(ctaRef.current, product.imageEmoji);
    if (dest.signedIn && dest.destination.type === "basket") {
      await addToDestination(dest.destination, product.id, qty);
      dest.announceAdd({
        productId: product.id,
        productName: name,
        quantity: qty,
        destination: dest.destination,
        destinationLabel: dest.destination.label,
      });
      return;
    }
    const existing = cart.items.find((i) => i.productId === product.id)?.quantity ?? 0;
    await cart.setQuantity(product, existing + qty);
    if (dest.signedIn) {
      dest.announceAdd({
        productId: product.id,
        productName: name,
        quantity: existing + qty,
        destination: { type: "cart" },
        destinationLabel: "Cart",
      });
    }
  };

  const addOverride = async (destination: Parameters<typeof addToDestination>[0]) => {
    await addToDestination(destination, product.id, qty);
    if (destination.type === "cart") await cart.refresh();
    dest.announceAdd({
      productId: product.id,
      productName: name,
      quantity: qty,
      destination,
      destinationLabel: destination.type === "cart" ? "Cart" : destination.label,
    });
  };

  const subscribeLabel = !isSubscriber ? "Subscribe to add" : "Add to standing basket";

  return (
    <Card>
      <DestinationPill />
      <p className="text-xs font-medium uppercase tracking-wide text-carbon">
        Freshly selected · Basket quality checked
      </p>
      <h1 className="text-heading-lg mt-2">{name}</h1>

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        {hasMemberSaving && (
          <span className="text-base text-muted line-through">{formatNaira(product.standardPrice)}</span>
        )}
        <span className="text-2xl font-semibold">{formatNaira(headlinePrice)}</span>
        {hasMemberSaving && (
          <span className="rounded-full bg-sky-wash px-2 py-0.5 text-xs font-medium text-carbon">
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
        <QuantityStepper
          variant="hero"
          alwaysStepper
          quantity={qty}
          min={product.minOrderQty}
          step={step}
          label={name}
          onChange={setQty}
          className="w-fit"
        />
      </div>

      {/* CTA */}
      <div className="mt-4">
        {mode === "one-time" ? (
          <div className="flex items-center gap-1.5">
            <Button ref={ctaRef} onClick={addOneTime} size="lg" className="w-full uppercase tracking-wide">
              {dest.signedIn && dest.destination.type === "basket" ? `Add to ${dest.destination.label}` : "Add to cart"}
            </Button>
            <DestinationOverrideChevron onPick={addOverride} />
          </div>
        ) : (
          <Button
            onClick={() => startTransition(() => addToStandingBasket(product.id, qty, frequency))}
            disabled={isPending}
            size="lg"
            className="w-full uppercase tracking-wide"
          >
            {isPending ? "Adding…" : subscribeLabel}
          </Button>
        )}
      </div>

      {/* Stock */}
      <p className="mt-3 flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full border border-carbon ${inSeason ? "bg-mint-pop" : "bg-ember"}`} />
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
        <label className="flex cursor-pointer items-center gap-2 border-b border-border p-3 has-[:checked]:bg-lavender">
          <input
            type="radio"
            name="mode"
            checked={mode === "one-time"}
            onChange={() => setMode("one-time")}
          />
          One-time purchase
        </label>
        <div className="p-3 has-[:checked]:bg-lavender">
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
    </Card>
  );
}
