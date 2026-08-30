import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/product-grid";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Prisma, ProductCategory } from "@/generated/prisma/client";

const CATEGORIES = ["FRUIT", "VEGETABLE", "BOX_BUNDLE", "SEASONAL"] as const;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    season?: string;
    min?: string;
    max?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const where: Prisma.ProductWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { tags: { has: q.toLowerCase() } },
    ];
  }
  if (sp.category) where.category = sp.category as ProductCategory;
  if (sp.season === "in-season") where.inSeason = true;
  const min = Number(sp.min) || undefined;
  const max = Number(sp.max) || undefined;
  if (min || max) where.standardPrice = { gte: min, lte: max };

  const products = q || sp.category || sp.season || min || max
    ? await prisma.product.findMany({ where, orderBy: { name: "asc" } })
    : [];

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, category: sp.category, season: sp.season, min: sp.min, max: sp.max, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/search?${params}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">
        {q ? `Results for "${q}"` : "Search"}
      </h1>

      <form action="/search" className="mt-4 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search produce"
          className="w-64 rounded-full border border-border px-4 py-2 text-sm"
        />
        <button className="rounded-full bg-ripe-green px-5 py-2 text-sm font-medium text-white">Search</button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={buildHref({ category: undefined })}
          className={`rounded-full px-3 py-1 ${!sp.category ? "bg-ripe-green text-white" : "border border-border"}`}
        >
          All categories
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref({ category: sp.category === c ? undefined : c })}
            className={`rounded-full px-3 py-1 ${sp.category === c ? "bg-ripe-green text-white" : "border border-border"}`}
          >
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
        <Link
          href={buildHref({ season: sp.season === "in-season" ? undefined : "in-season" })}
          className={`rounded-full px-3 py-1 ${sp.season === "in-season" ? "bg-ripe-green text-white" : "border border-border"}`}
        >
          In season
        </Link>
        <span className="mx-1 h-4 w-px bg-border" />
        {[
          ["Under ₦1,000", { min: undefined, max: "1000" }],
          ["₦1,000 to ₦3,000", { min: "1000", max: "3000" }],
          ["₦3,000+", { min: "3000", max: undefined }],
        ].map(([label, patch]) => (
          <Link
            key={label as string}
            href={buildHref(patch as Record<string, string | undefined>)}
            className="rounded-full border border-border px-3 py-1"
          >
            {label as string}
          </Link>
        ))}
      </div>

      <div className="mt-8">
        {q || sp.category || sp.season || min || max ? (
          <ProductGrid products={products} />
        ) : (
          <p className="text-sm text-muted">Type a search above, or browse the collections in the nav.</p>
        )}
      </div>
    </div>
  );
}
