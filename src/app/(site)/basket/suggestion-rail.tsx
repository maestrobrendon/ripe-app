"use client";

import { ProductCard, type ProductCardData } from "@/components/product-card";
import { Rail } from "@/components/ui/rail";

/** A row of products to add, each with its own stepper showing what's already in the order. */
export function SuggestionRail({ title, subtitle, products }: { title: string; subtitle: string; products: ProductCardData[] }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="text-xl font-semibold tracking-[-0.015em]">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
      <Rail label={title} className="mt-4">
        {products.map((p) => (
          <div key={p.id} className="w-[10.5rem] shrink-0 snap-start sm:w-44">
            <ProductCard product={p} />
          </div>
        ))}
      </Rail>
    </section>
  );
}
