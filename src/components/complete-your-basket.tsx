"use client";

import Link from "next/link";
import { useCart, type AddableProduct } from "@/components/cart-provider";
import { formatNaira } from "@/lib/format";

export type CrossSellProduct = AddableProduct & {
  ratingAvg: number | null;
  ratingCount: number;
};

function Stars({ avg }: { avg: number }) {
  const full = Math.round(avg);
  return (
    <span className="text-xs text-ripe-terracotta-dark" aria-label={`${avg} out of 5`}>
      {"★".repeat(full)}
      <span className="text-border">{"★".repeat(5 - full)}</span>
    </span>
  );
}

function Card({ product }: { product: CrossSellProduct }) {
  const cart = useCart();
  const inCart = cart.items.some((i) => i.productId === product.id);
  const chooseOptions = product.orderUnit === "WEIGHT";
  const price = cart.isSubscriber ? product.memberPrice : product.standardPrice;

  return (
    <div className="flex w-56 shrink-0 flex-col rounded-2xl border border-border bg-surface p-4">
      <Link
        href={`/products/${product.slug}`}
        className="mb-3 flex h-28 items-center justify-center rounded-xl bg-ripe-green-light text-5xl"
      >
        {product.imageEmoji}
      </Link>
      <Link href={`/products/${product.slug}`} className="text-sm font-medium leading-snug hover:underline">
        {product.name}
      </Link>
      {product.ratingCount > 0 && product.ratingAvg != null && (
        <div className="mt-1 flex items-center gap-1">
          <Stars avg={product.ratingAvg} />
          <span className="text-[11px] text-muted">{product.ratingCount} reviews</span>
        </div>
      )}
      <p className="mt-1 text-sm font-semibold">
        {chooseOptions ? "From " : ""}
        {formatNaira(price)}
      </p>
      <p className="text-[11px] text-muted">{product.unit}</p>

      <div className="mt-3">
        {chooseOptions ? (
          <Link
            href={`/products/${product.slug}`}
            className="block w-full rounded-full border border-ripe-green px-4 py-2 text-center text-xs font-medium uppercase tracking-wide text-ripe-green hover:bg-ripe-green-light"
          >
            Choose options
          </Link>
        ) : (
          <button
            onClick={() => cart.setQuantity(product, (cart.items.find((i) => i.productId === product.id)?.quantity ?? 0) + product.minOrderQty)}
            className="w-full rounded-full border border-ripe-green px-4 py-2 text-xs font-medium uppercase tracking-wide text-ripe-green hover:bg-ripe-green-light"
          >
            {inCart ? "Add another" : "Add to cart"}
          </button>
        )}
      </div>
    </div>
  );
}

export function CompleteYourBasket({ products }: { products: CrossSellProduct[] }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <h2 className="text-xl font-semibold">Complete your basket</h2>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {products.map((p) => (
          <Card key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
