"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { useDestination, type Destination } from "@/components/destination-provider";
import { DestinationOverrideChevron, addToDestination } from "@/components/destination-pill";
import { setBasketItemQuantity } from "@/app/basket/actions";
import { ProductImage } from "@/components/product-image";
import { Card } from "@/components/ui/card";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { flyToCart } from "@/components/ui/fly-to-cart";
import { formatNaira } from "@/lib/format";
import { flavourFor } from "@/lib/flavour";
import type { ProductCategory } from "@/generated/prisma/enums";

export type ProductCardData = AddableProduct & {
  inSeason: boolean;
  description: string | null;
  category: ProductCategory;
  tags: string[];
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const cart = useCart();
  const dest = useDestination();
  const goingToBasket = dest.signedIn && dest.destination.type === "basket";

  // Only the cart tracks item quantity client-side app-wide; a basket
  // destination's quantity here is this card's own optimistic count of what
  // it has sent this basket this session, not a live read of the basket.
  const [basketQty, setBasketQty] = useState(0);
  const [basketLoading, setBasketLoading] = useState(false);
  const destinationKey = dest.signedIn && dest.destination.type === "basket" ? dest.destination.basketId : "cart";
  useEffect(() => {
    // Resets this card's optimistic count when the "shopping into" target
    // changes, so switching baskets doesn't carry over a stale local number.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBasketQty(0);
  }, [destinationKey]);

  const cartLine = cart.items.find((i) => i.productId === product.id);
  const quantity = goingToBasket ? basketQty : cartLine?.quantity ?? 0;
  const isLoading = goingToBasket ? basketLoading : cart.loadingProductId === product.id;
  const price = cart.isSubscriber ? product.memberPrice : product.standardPrice;
  const href = `/products/${product.slug}`;

  const change = async (next: number) => {
    if (goingToBasket && dest.destination.type === "basket") {
      setBasketLoading(true);
      try {
        await setBasketItemQuantity(dest.destination.basketId, product.id, next);
        setBasketQty(next);
        if (next > basketQty) {
          dest.announceAdd({
            productId: product.id,
            productName: product.name,
            quantity: next,
            destination: dest.destination,
            destinationLabel: dest.destination.label,
          });
        }
      } finally {
        setBasketLoading(false);
      }
      return;
    }
    const wasEmpty = quantity === 0;
    await cart.setQuantity(product, next);
    if (wasEmpty && next > 0 && dest.signedIn) {
      dest.announceAdd({
        productId: product.id,
        productName: product.name,
        quantity: next,
        destination: { type: "cart" },
        destinationLabel: "Cart",
      });
    }
  };

  const addOverride = async (destination: Destination) => {
    await addToDestination(destination, product.id, product.minOrderQty);
    if (destination.type === "cart") await cart.refresh();
    dest.announceAdd({
      productId: product.id,
      productName: product.name,
      quantity: product.minOrderQty,
      destination,
      destinationLabel: destination.type === "cart" ? "Cart" : destination.label,
    });
  };

  return (
    <Card className="flex flex-col transition hover:bg-sky-wash">
      <Link href={href} className="mb-2 block sm:mb-3">
        <ProductImage
          publicId={product.cloudinaryPublicId}
          alt={product.name}
          emoji={product.imageEmoji}
          flavour={flavourFor(product.category, product.tags)}
          className="h-28 w-full sm:h-32"
          emojiClassName="text-5xl sm:text-6xl"
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
        />
      </Link>

      {/* Fixed-height title, badge, and price blocks so a card with a long
          name and a member-price line takes the same room as one without,
          keeping every card in a row the same height regardless of content. */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 min-h-10 min-w-0 text-sm font-medium leading-snug break-words sm:min-h-11 sm:text-base">
          <Link href={href} className="hover:underline">{product.name}</Link>
        </h3>
        {!product.inSeason && (
          <span className="shrink-0 rounded-full bg-ember/12 px-1.5 py-0.5 text-[10px] font-medium text-carbon sm:px-2 sm:text-[11px]">
            Off-season
          </span>
        )}
      </div>
      <p className="mb-2 truncate text-xs text-muted">{product.unit}</p>

      <div className="mb-3 flex flex-col gap-0.5">
        <span className="text-base font-semibold sm:text-lg">{formatNaira(price)}</span>
        <span className="text-xs text-muted">
          {cart.isSubscriber ? (
            <span className="line-through">{formatNaira(product.standardPrice)}</span>
          ) : product.memberPrice < product.standardPrice ? (
            <>members {formatNaira(product.memberPrice)}</>
          ) : (
            <>&nbsp;</>
          )}
        </span>
      </div>

      <div className="mt-auto flex items-center gap-1.5">
        <QuantityStepper
          quantity={quantity}
          min={product.minOrderQty}
          step={product.stepQty}
          label={product.name}
          loading={isLoading}
          suffix={goingToBasket ? `in ${dest.destination.type === "basket" ? dest.destination.label : "basket"}` : "in cart"}
          onAddFrom={(el) => flyToCart(el, product.imageEmoji)}
          onChange={change}
        />
        <DestinationOverrideChevron onPick={addOverride} />
      </div>
    </Card>
  );
}
