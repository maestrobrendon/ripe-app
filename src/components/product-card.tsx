"use client";

import { useBasket } from "@/components/basket-provider";
import { formatNaira } from "@/lib/format";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  imageEmoji: string;
  memberPrice: number;
  marketPrice: number;
  inSeason: boolean;
  source: string;
  description: string | null;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const basket = useBasket();
  const inBasket = basket.items.find((i) => i.productId === product.id);
  const quantity = inBasket?.quantity ?? 0;
  const isLoading = basket.loadingProductId === product.id;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-4 transition hover:shadow-sm">
      <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-ripe-green-light text-6xl">
        {product.imageEmoji}
      </div>

      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-medium leading-snug">{product.name}</h3>
        {!product.inSeason && (
          <span className="shrink-0 rounded-full bg-ripe-terracotta-light px-2 py-0.5 text-[11px] font-medium text-ripe-terracotta-dark">
            Off-season
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted">{product.unit} · {product.source}</p>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-lg font-semibold">{formatNaira(product.memberPrice)}</span>
        <span className="text-xs text-muted line-through">vs {formatNaira(product.marketPrice)}</span>
      </div>

      <div className="mt-auto">
        {quantity === 0 ? (
          <button
            disabled={isLoading}
            onClick={() =>
              basket.setQuantity(
                { id: product.id, slug: product.slug, name: product.name, unit: product.unit, imageEmoji: product.imageEmoji, memberPrice: product.memberPrice, marketPrice: product.marketPrice },
                1
              )
            }
            className="w-full rounded-full bg-ripe-green px-4 py-2 text-sm font-medium text-white hover:bg-ripe-green-dark disabled:opacity-60"
          >
            + Add
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-full border border-ripe-green px-2 py-1">
            <button
              disabled={isLoading}
              onClick={() =>
                basket.setQuantity(
                  { id: product.id, slug: product.slug, name: product.name, unit: product.unit, imageEmoji: product.imageEmoji, memberPrice: product.memberPrice, marketPrice: product.marketPrice },
                  quantity - 1
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-full text-ripe-green"
            >
              −
            </button>
            <span className="text-sm font-medium">{quantity} in basket</span>
            <button
              disabled={isLoading}
              onClick={() =>
                basket.setQuantity(
                  { id: product.id, slug: product.slug, name: product.name, unit: product.unit, imageEmoji: product.imageEmoji, memberPrice: product.memberPrice, marketPrice: product.marketPrice },
                  quantity + 1
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-full text-ripe-green"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
