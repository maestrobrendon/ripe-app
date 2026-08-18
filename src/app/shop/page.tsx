import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";
import type { Prisma, ProductCategory } from "@/generated/prisma/client";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "FRUIT", label: "Fruits" },
  { value: "VEGETABLE", label: "Vegetables" },
  { value: "COMBO", label: "Combos" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; season?: string; q?: string }>;
}) {
  const { category, season, q } = await searchParams;

  const where: Prisma.ProductWhereInput = {};
  if (category) where.category = category as ProductCategory;
  if (season === "in-season") where.inSeason = true;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const products = await prisma.product.findMany({ where, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Shop</h1>
          <p className="mt-1 text-sm text-muted">Member pricing, farm-direct from Ogun, Oyo and Ondo states.</p>
        </div>

        <form className="flex gap-2" action="/shop">
          {category && <input type="hidden" name="category" value={category} />}
          {season && <input type="hidden" name="season" value={season} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search produce…"
            className="w-56 rounded-full border border-border px-4 py-2 text-sm"
          />
        </form>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => {
          const params = new URLSearchParams();
          if (c.value) params.set("category", c.value);
          if (season) params.set("season", season);
          if (q) params.set("q", q);
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
            if (q) params.set("q", q);
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

      {products.length === 0 ? (
        <p className="text-sm text-muted">No produce matches that filter right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                id: p.id,
                slug: p.slug,
                name: p.name,
                unit: p.unit,
                imageEmoji: p.imageEmoji,
                memberPrice: p.memberPrice,
                marketPrice: p.marketPrice,
                inSeason: p.inSeason,
                source: p.source,
                description: p.description,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
