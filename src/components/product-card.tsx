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
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 transition hover:shadow-sm">
      <Link href={href} className="mb-3 block">
        <ProductImage
          publicId={product.cloudinaryPublicId}
          alt={product.name}
          emoji={product.imageEmoji}
          className="h-32 w-full"
        />
      </Link>

      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-medium leading-snug">
          <Link href={href} className="hover:underline">{product.name}</Link>
        </h3>
        {!product.inSeason && (
          <span className="shrink-0 rounded-full bg-ripe-terracotta-light px-2 py-0.5 text-[11px] font-medium text-ripe-terracotta-dark">
            Off-season
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted">{product.unit}</p>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-lg font-semibold">{formatNaira(price)}</span>
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
            className="w-full rounded-full bg-ripe-green px-4 py-2 text-sm font-medium text-white hover:bg-ripe-green-dark disabled:opacity-60"
          >
            + Add
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-full border border-ripe-green px-2 py-1">
            <button
              disabled={isLoading}
              onClick={() => change(quantity - product.stepQty)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ripe-green"
              aria-label={`Reduce ${product.name}`}
            >
              −
            </button>
            <span className="text-sm font-medium">{quantity} in cart</span>
            <button
              disabled={isLoading}
              onClick={() => change(quantity + product.stepQty)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ripe-green"
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
