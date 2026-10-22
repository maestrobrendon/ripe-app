import { ProductCard } from "@/components/product-card";
import { toCardData } from "@/lib/product";
import type { Product } from "@/generated/prisma/client";

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="text-sm text-muted">Nothing here matches that right now.</p>;
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={toCardData(p)} />
        ))}
      </div>
    </div>
  );
}
