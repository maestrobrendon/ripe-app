import { ProductCard } from "@/components/product-card";
import { toCardData } from "@/lib/product";
import type { Product } from "@/generated/prisma/client";

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="text-sm text-muted">Nothing here matches that right now.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={toCardData(p)} />
      ))}
    </div>
  );
}
