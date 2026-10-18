"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { formatNaira } from "@/lib/format";
import { quantityLabel, unitPriceLabel } from "@/lib/delivery-labels";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { flyToCart } from "@/components/ui/fly-to-cart";

/**
 * The product page's buy box: one price (the one this customer pays), how many,
 * and one button that adds them on top of whatever's already in the order.
 * Nothing here signs anyone up or renews anything.
 */
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
  const ctaRef = useRef<HTMLButtonElement>(null);
  const signedIn = cart.container === "delivery";
  const already = cart.quantityOf(product.id);
  const price = isSubscriber ? product.memberPrice : product.standardPrice;
  const hasMemberSaving = product.memberPrice < product.standardPrice;

  const add = async () => {
    if (ctaRef.current) flyToCart(ctaRef.current, product.imageEmoji);
    await cart.setQuantity(product, already + qty);
  };

  const target = signedIn ? cart.deliveryLabel ?? "your order" : "cart";
  const freeAt = cart.freeDeliveryThreshold;

  return (
    <div className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline sm:p-6">
      <p className="text-[12px] font-semibold tracking-[0.06em] text-carbon/55 uppercase">Freshly selected · Checked by hand</p>
      <h1 className="mt-1.5 text-[30px] leading-[1.1] font-bold tracking-[-0.02em] sm:text-[34px]">{name}</h1>

      <p className="mt-3 text-[24px] font-semibold tracking-[-0.01em]">{unitPriceLabel(formatNaira(price), product.unit)}</p>
      {hasMemberSaving && !isSubscriber && (
        <p className="mt-1 text-sm text-muted">
          Members pay {formatNaira(product.memberPrice)}.{" "}
          <Link href="/subscribe" className="font-medium text-carbon underline underline-offset-2">
            See membership
          </Link>
        </p>
      )}
      <p className="mt-1 text-sm text-muted">
        {cart.freeDelivery
          ? "Free delivery on your membership."
          : `Delivery ${formatNaira(cart.deliveryFee)} to your area, free on orders over ${formatNaira(freeAt)}.`}
      </p>

      <div className="mt-5">
        <p className="mb-1 text-xs font-medium text-muted">How many</p>
        <QuantityStepper variant="hero" alwaysStepper quantity={qty} min={product.minOrderQty} step={product.stepQty} label={name} onChange={setQty} className="w-fit" />
        <p className="mt-1.5 text-xs text-muted">{quantityLabel(qty, product.unit)}</p>
      </div>

      <div className="mt-4">
        <Button ref={ctaRef} onClick={add} disabled={product.soldOut || cart.loadingProductId === product.id} size="lg" className="w-full">
          {product.soldOut ? "Sold out" : signedIn ? `Add to ${target}` : "Add to cart"}
        </Button>
        {already > 0 && (
          <p className="mt-2 text-center text-sm text-muted">
            Already in {target}: {quantityLabel(already, product.unit)}.{" "}
            <Link href={signedIn ? "/basket" : "/cart"} className="font-medium text-carbon underline underline-offset-2">
              View
            </Link>
          </p>
        )}
      </div>

      <p className="mt-4 flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full border border-carbon ${product.soldOut ? "bg-carbon/30" : inSeason ? "bg-mint-pop" : "bg-ember"}`} />
        {product.soldOut ? "Sold out right now. We'll have more soon." : inSeason ? "In stock" : "Limited this week"}
      </p>

      <ul className="mt-5 grid gap-2.5 border-t border-hairline pt-4 text-[14px]">
        {(
          [
            ["quality", "Checked by hand before it leaves"],
            ["undo", "Bruised or wrong? We put it right"],
            ["payment", "Pay when it arrives"],
          ] as const
        ).map(([icon, text]) => (
          <li key={text} className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft-mist">
              <Icon name={icon} size={14} weight="bold" />
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}
