"use client";

import Link from "next/link";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { Icon } from "@/components/ui/icon";

export type ProductCardData = AddableProduct & {
  inSeason: boolean;
  description: string | null;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const cart = useCart();
  const line = cart.items.find((i) => i.productId === product.id);
  const quantity = line?.quantity ?? 0;
  const isLoading = cart.loadingProductId === product.id;
  const price = cart.isSubscriber ? product.memberPrice : product.standardPrice;
  const href = `/products/${product.slug}`;

  const change = (next: number) => cart.setQuantity(product, next);

  return (
    <Card className="flex flex-col transition hover:border-basket-green">
      <Link href={href} className="mb-2 block sm:mb-3">
        <ProductImage
          publicId={product.cloudinaryPublicId}
          alt={product.name}
          emoji={product.imageEmoji}
          className="h-28 w-full sm:h-32"
          emojiClassName="text-5xl sm:text-6xl"
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
        />
      </Link>

      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug sm:text-base">
          <Link href={href} className="hover:underline">{product.name}</Link>
        </h3>
        {!product.inSeason && (
          <span className="shrink-0 rounded-full bg-basket-terracotta-light px-1.5 py-0.5 text-[10px] font-medium text-basket-terracotta-dark sm:px-2 sm:text-[11px]">
            Off-season
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted">{product.unit}</p>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-base font-semibold sm:text-lg">{formatNaira(price)}</span>
        {cart.isSubscriber ? (
          <span className="text-xs text-muted line-through">{formatNaira(product.standardPrice)}</span>
        ) : (
          product.memberPrice < product.standardPrice && (
            <span className="text-xs text-muted">members {formatNaira(product.memberPrice)}</span>
          )
        )}
      </div>

      <div className="mt-auto">
        {quantity === 0 ? (
          <Button
            disabled={isLoading}
            onClick={() => change(product.minOrderQty)}
            size="sm"
            className="tap-target w-full"
          >
            + Add
          </Button>
        ) : (
          <div className="flex items-center justify-between rounded-full border border-basket-green px-1 py-1">
            <button
              disabled={isLoading}
              onClick={() => change(quantity - product.stepQty)}
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-basket-green"
              aria-label={`Reduce ${product.name}`}
            >
              <Icon name="minus" size={16} />
            </button>
            <span className="text-xs font-medium sm:text-sm">{quantity} in cart</span>
            <button
              disabled={isLoading}
              onClick={() => change(quantity + product.stepQty)}
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-basket-green"
              aria-label={`Add ${product.name}`}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
