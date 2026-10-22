"use client";

import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Rail } from "@/components/ui/rail";

/** "Goes well with it" under a product: the same cards and rail as everywhere else. */
export function CompleteYourBasket({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <h2 className="text-xl font-semibold tracking-[-0.015em]">Goes well with it</h2>
      <Rail label="Goes well with it" className="mt-4">
        {products.map((p) => (
          <div key={p.id} className="w-[10.5rem] shrink-0 snap-start sm:w-48">
            <ProductCard product={p} />
          </div>
        ))}
      </Rail>
    </section>
  );
}
