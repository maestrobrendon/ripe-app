"use client";

import { ProductCard, type ProductCardData } from "@/components/product-card";

/** A row of products to add, each with its own stepper showing what's already in the order. */
export function SuggestionRail({ title, subtitle, products }: { title: string; subtitle: string; products: ProductCardData[] }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">{subtitle}</p>
      <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {products.map((p) => (
          <div key={p.id} className="w-40 shrink-0 snap-start sm:w-44">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
