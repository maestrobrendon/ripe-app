import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/product-grid";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Prisma, ProductCategory } from "@/generated/prisma/client";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "FRUIT", label: CATEGORY_LABEL.FRUIT },
  { value: "VEGETABLE", label: CATEGORY_LABEL.VEGETABLE },
  { value: "BOX_BUNDLE", label: CATEGORY_LABEL.BOX_BUNDLE },
  { value: "SEASONAL", label: CATEGORY_LABEL.SEASONAL },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; season?: string }>;
}) {
  const { category, season } = await searchParams;

  const where: Prisma.ProductWhereInput = {};
  if (category) where.category = category as ProductCategory;
  if (season === "in-season") where.inSeason = true;

  const products = await prisma.product.findMany({ where, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Shop all produce</h1>
      <p className="mt-1 text-sm text-muted">
        Sourced locally from trusted farmers. Anyone can shop, no subscription needed.
      </p>

      <div className="mb-8 mt-6 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => {
          const params = new URLSearchParams();
          if (c.value) params.set("category", c.value);
          if (season) params.set("season", season);
          const href = `/shop${params.toString() ? `?${params}` : ""}`;
          const active = (category ?? "") === c.value;
          return (
            <Link
              key={c.value || "all"}
              href={href}
              className={`rounded-full px-4 py-1.5 text-sm ${
                active ? "bg-ripe-green text-white" : "border border-border hover:bg-ripe-green-light"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px bg-border" />
        <Link
          href={(() => {
            const params = new URLSearchParams();
            if (category) params.set("category", category);
            if (season !== "in-season") params.set("season", "in-season");
            return `/shop${params.toString() ? `?${params}` : ""}`;
          })()}
          className={`rounded-full px-4 py-1.5 text-sm ${
            season === "in-season" ? "bg-ripe-green text-white" : "border border-border hover:bg-ripe-green-light"
          }`}
        >
          In season only
        </Link>
      </div>

      <ProductGrid products={products} />
    </div>
  );
}
