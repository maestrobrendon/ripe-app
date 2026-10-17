"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { formatNaira } from "@/lib/format";
import { quantityLabel, unitPriceLabel } from "@/lib/delivery-labels";
import { Card } from "@/components/ui/card";
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
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-carbon">Freshly selected · Checked by hand</p>
      <h1 className="text-heading-lg mt-2">{name}</h1>

      <p className="mt-3 text-2xl font-semibold">{unitPriceLabel(formatNaira(price), product.unit)}</p>
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

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-[11px] text-muted">
        <span>Checked by hand before it leaves</span>
        <span>Bruised or wrong? We put it right</span>
        <span>Pay on delivery</span>
      </div>
    </Card>
  );
}
