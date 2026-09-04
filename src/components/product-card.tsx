"use client";

import Link from "next/link";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";

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
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-3 transition hover:shadow-sm sm:p-4">
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
          <span className="shrink-0 rounded-full bg-ripe-terracotta-light px-1.5 py-0.5 text-[10px] font-medium text-ripe-terracotta-dark sm:px-2 sm:text-[11px]">
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
          <button
            disabled={isLoading}
            onClick={() => change(product.minOrderQty)}
            className="tap-target w-full rounded-full bg-ripe-green px-4 py-2 text-sm font-medium text-white hover:bg-ripe-green-dark disabled:opacity-60"
          >
            + Add
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-full border border-ripe-green px-1 py-1">
            <button
              disabled={isLoading}
              onClick={() => change(quantity - product.stepQty)}
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-ripe-green"
              aria-label={`Reduce ${product.name}`}
            >
              −
            </button>
            <span className="text-xs font-medium sm:text-sm">{quantity} in cart</span>
            <button
              disabled={isLoading}
              onClick={() => change(quantity + product.stepQty)}
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-ripe-green"
              aria-label={`Add ${product.name}`}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
