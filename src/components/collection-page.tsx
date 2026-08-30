import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/product-grid";
import type { Prisma } from "@/generated/prisma/client";

/** Shared layout for the nav collection pages (Fruits, Boxes & Baskets, Fresh Cuts). */
export async function CollectionPage({
  title,
  blurb,
  where,
}: {
  title: string;
  blurb: string;
  where: Prisma.ProductWhereInput;
}) {
  const products = await prisma.product.findMany({ where, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{blurb}</p>
        </div>
        <Link href="/shop" className="text-sm font-medium text-ripe-green underline">
          Shop all produce
        </Link>
      </div>
      <ProductGrid products={products} />
    </div>
  );
}
