import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductGrid } from "@/components/product-grid";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Prisma, ProductCategory } from "@/generated/prisma/client";
import { OFFERED } from "@/lib/product";
import { getCurrentUser } from "@/lib/session";
import { getMenu } from "@/lib/menu";
import { getMenuCards } from "@/app/(site)/recipes/recipe-data";
import { RecipeCard } from "@/app/(site)/recipes/recipe-card";
import "@/app/(bare)/home-menu/home-menu.css";

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
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const q = sp.q?.trim() ?? "";
  const member = Boolean(user?.subscriptionTierId);

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
  // Price bands use the price this customer pays.
  if (min || max) where[member ? "memberPrice" : "standardPrice"] = { gte: min, lte: max };

  const products = q || sp.category || sp.season || min || max
    ? await prisma.product.findMany({ where: { ...where, ...OFFERED }, orderBy: { name: "asc" } })
    : [];

  // Recipes match on their name, their one-liner, or anything that goes in them.
  const recipes = q ? await matchingRecipes(q) : [];

  const buildHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, category: sp.category, season: sp.season, min: sp.min, max: sp.max, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/search?${params}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">{q ? `Results for “${q}”` : "Search"}</h1>

      <form action="/search" role="search" className="mt-4 flex gap-2 sm:max-w-lg">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Fruit, veg or a recipe"
          aria-label="Search"
          className="h-11 min-w-0 flex-1 rounded-xl bg-black/[0.05] px-4 text-[16px] outline-none placeholder:text-carbon/45 focus:bg-surface focus:shadow-[0_0_0_1px_var(--color-hairline),0_0_0_4px_rgb(0_0_0/0.06)]"
        />
        <button className="h-11 rounded-full bg-carbon px-5 text-[15px] font-semibold text-paper-white active:scale-[0.97]">Search</button>
      </form>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 text-[14px] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Link
          href={buildHref({ category: undefined })}
          className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 font-semibold transition-colors ${!sp.category ? "bg-carbon text-paper-white" : "bg-black/[0.05] text-carbon/80 hover:bg-black/[0.08]"}`}
        >
          All categories
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref({ category: sp.category === c ? undefined : c })}
            className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 font-semibold transition-colors ${sp.category === c ? "bg-carbon text-paper-white" : "bg-black/[0.05] text-carbon/80 hover:bg-black/[0.08]"}`}
          >
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
        <Link
          href={buildHref({ season: sp.season === "in-season" ? undefined : "in-season" })}
          className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 font-semibold transition-colors ${sp.season === "in-season" ? "bg-carbon text-paper-white" : "bg-black/[0.05] text-carbon/80 hover:bg-black/[0.08]"}`}
        >
          In season
        </Link>
        <span className="mx-1 w-px shrink-0 self-stretch bg-hairline" aria-hidden />
        {[
          ["Under ₦1,000", { min: undefined, max: "1000" }],
          ["₦1,000 to ₦3,000", { min: "1000", max: "3000" }],
          ["₦3,000+", { min: "3000", max: undefined }],
        ].map(([label, patch]) => (
          <Link
            key={label as string}
            href={buildHref(patch as Record<string, string | undefined>)}
            className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 font-semibold transition-colors bg-black/[0.05] text-carbon/80 hover:bg-black/[0.08]"
          >
            {label as string}
          </Link>
        ))}
      </div>

      {recipes.length > 0 && (
        <section className="hm mt-8" aria-label="Recipes">
          <h2 className="text-xl font-semibold tracking-[-0.015em]">Recipes</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.slice(0, 6).map((r) => (
              <RecipeCard key={r.slug} recipe={r} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8">
        {recipes.length > 0 && products.length > 0 && <h2 className="mb-3 text-xl font-semibold tracking-[-0.015em]">Produce</h2>}
        {q || sp.category || sp.season || min || max ? (
          <ProductGrid products={products} />
        ) : (
          <p className="text-sm text-muted">Type a search above, or browse the collections in the nav.</p>
        )}
      </div>
    </div>
  );
}

async function matchingRecipes(q: string) {
  const needle = q.toLowerCase();
  const [cards, menu, products] = await Promise.all([getMenuCards(), getMenu(), prisma.product.findMany({ where: OFFERED, select: { slug: true, name: true } })]);
  const nameBySlug = new Map(products.map((p) => [p.slug, p.name]));
  const words = new Map(menu.map((r) => [r.slug, [r.title, r.hook, ...r.basket.map((s) => nameBySlug.get(s) ?? s.replace(/-/g, " ")), ...r.elsewhere].join(" ").toLowerCase()]));
  return cards.filter((c) => words.get(c.slug)?.includes(needle));
}
