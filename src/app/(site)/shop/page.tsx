import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatNaira } from "@/lib/format";
import { OFFERED, toCardData } from "@/lib/product";
import { ProductCard } from "@/components/product-card";
import { Eyebrow } from "@/app/(bare)/home-menu/parts/shared";
import { AddTargetChip } from "@/components/add-target";
import type { Prisma, Product, ProductCategory } from "@/generated/prisma/client";
import "@/app/(bare)/home-menu/home-menu.css";

export const metadata: Metadata = {
  title: "Fruits. Basket",
  description: "Every fruit and vegetable Basket sells, with the standard price and the member price side by side.",
};

/** The groups, in the order the page shows them. Boxes come last: they're a shortcut, not the catalogue. */
const GROUPS: { id: ProductCategory; label: string; blurb: string }[] = [
  { id: "FRUIT", label: "Fruits", blurb: "For breakfasts, lunchboxes and snacking." },
  { id: "VEGETABLE", label: "Vegetables", blurb: "The base of every recipe on the menu." },
  { id: "SEASONAL", label: "Seasonal specials", blurb: "Only around for a few weeks of the year." },
  { id: "BOX_BUNDLE", label: "Ready-made boxes", blurb: "Pre-picked mixes for a purpose, like a week of breakfasts or salad nights." },
];

type Search = { category?: string; season?: string; q?: string };

function hrefWith(current: Search, patch: Search) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.season) params.set("season", next.season);
  if (next.q) params.set("q", next.q);
  const qs = params.toString();
  return `/shop${qs ? `?${qs}` : ""}`;
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const category = GROUPS.some((g) => g.id === sp.category) ? (sp.category as ProductCategory) : null;
  const inSeasonOnly = sp.season === "in-season";
  const q = sp.q?.trim().slice(0, 60) ?? "";

  const where: Prisma.ProductWhereInput = { ...OFFERED };
  if (category) where.category = category;
  if (inSeasonOnly) where.inSeason = true;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { tags: { has: q.toLowerCase() } }];

  const [products, everything, cheapestTier, user] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ featured: "desc" }, { name: "asc" }] }),
    prisma.product.findMany({ where: OFFERED, select: { standardPrice: true, memberPrice: true, category: true } }),
    prisma.subscriptionTier.findFirst({ orderBy: { monthlyFee: "asc" }, select: { monthlyFee: true } }),
    getCurrentUser(),
  ]);
  const isSubscriber = Boolean(user?.subscriptionTierId);

  // The honest headline number: the average member discount across what we sell.
  const discounted = everything.filter((p) => p.memberPrice < p.standardPrice);
  const avgSaving = discounted.length
    ? Math.round((discounted.reduce((s, p) => s + (1 - p.memberPrice / p.standardPrice), 0) / discounted.length) * 100)
    : 0;
  const produceCount = everything.filter((p) => p.category === "FRUIT" || p.category === "VEGETABLE" || p.category === "SEASONAL").length;
  // A familiar item makes the clearest example, when it's in the current view.
  const familiar = ["banana", "tomato", "avocado", "onion", "pineapple"];
  const discountedHere = products.filter((p) => p.memberPrice < p.standardPrice && p.category !== "BOX_BUNDLE");
  const example =
    familiar.map((slug) => discountedHere.find((p) => p.slug === slug)).find(Boolean) ?? discountedHere[0] ?? null;

  const grouped = !category && !q;
  const groups = GROUPS.map((g) => ({ ...g, items: products.filter((p) => p.category === g.id) })).filter((g) => g.items.length > 0);

  const chip = (on: boolean) =>
    `inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold transition-colors ${
      on ? "bg-carbon text-paper-white" : "bg-[var(--hm-tint)] text-carbon/75 hover:text-carbon"
    }`;

  return (
    <div className="hm">
      {user ? (
        // A customer already knows how pricing works: a plain page title, then the shelves.
        <div className="hm-wrap pt-6 sm:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]">Shop</h1>
            <AddTargetChip />
          </div>
          <p className="mt-1 text-[15px] text-[var(--hm-ink-2)]">
            {produceCount} fruits and vegetables, plus ready-made boxes.
            {!isSubscriber && avgSaving > 0 && (
              <>
                {" "}Members pay about {avgSaving}% less.{" "}
                <Link href="/subscribe" className="font-semibold text-carbon underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
                  See membership
                </Link>
              </>
            )}
          </p>
        </div>
      ) : (
      <section className="bg-[var(--hm-tint)]">
        <div className="hm-wrap grid gap-8 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-14">
          <div>
            <Eyebrow>The shop</Eyebrow>
            <h1 className="hm-h2 max-w-[18ch]">Every fruit and vegetable, priced up front.</h1>
            <p className="hm-lede mt-4 max-w-xl">
              {produceCount} fruits and vegetables, plus ready-made boxes. Look around without an account. Every item shows what
              anyone pays, and what members pay.
            </p>
          </div>

          {/* The two prices, explained once, so every card below reads at a glance. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-paper-white p-5">
              <p className="text-[13px] font-semibold text-[var(--hm-ink-2)]">Market price</p>
              <p className="mt-1 text-[15px] leading-relaxed">What anyone pays. No membership, no minimum order.</p>
              {example && (
                <p className="mt-4 text-[13px] text-[var(--hm-ink-2)]">
                  {example.name}: <b className="text-[16px] font-semibold text-carbon tabular-nums">{formatNaira(example.standardPrice)}</b>
                </p>
              )}
            </div>
            <div className="rounded-[24px] bg-carbon p-5 text-paper-white">
              <p className="text-[13px] font-semibold text-paper-white/70">Member price</p>
              <p className="mt-1 text-[15px] leading-relaxed">
                {avgSaving > 0 ? `About ${avgSaving}% less on everything` : "Less on everything"}
                {cheapestTier ? `, from ${formatNaira(cheapestTier.monthlyFee)} a month.` : "."}
              </p>
              {example && (
                <p className="mt-4 text-[13px] text-paper-white/70">
                  {example.name}: <b className="text-[16px] font-semibold text-mint-pop tabular-nums">{formatNaira(example.memberPrice)}</b>
                </p>
              )}
              {!isSubscriber && (
                <Link href="/subscribe" className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold underline decoration-paper-white/40 underline-offset-4 hover:decoration-paper-white">
                  Compare plans
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      <div className={`hm-wrap ${user ? "pt-5 pb-12" : "py-10 sm:py-12"}`}>
        <div className="flex flex-col gap-4">
          <form action="/shop" className="relative w-full sm:max-w-md" role="search">
            {category && <input type="hidden" name="category" value={category} />}
            {inSeasonOnly && <input type="hidden" name="season" value="in-season" />}
            <label htmlFor="shop-q" className="sr-only">
              Search produce
            </label>
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--hm-ink-3)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.2 13.2L17 17" />
            </svg>
            <input
              id="shop-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search mango, spinach, pepper…"
              className="h-12 w-full rounded-full bg-[var(--hm-tint)] pr-4 pl-12 text-[15px] outline-none placeholder:text-[var(--hm-ink-3)] focus:bg-paper-white focus:shadow-[0_0_0_2px_var(--color-carbon)]"
            />
          </form>

          <nav aria-label="Filter produce" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link href={hrefWith(sp, { category: undefined })} aria-current={!category ? "page" : undefined} className={chip(!category)}>
              All
            </Link>
            {GROUPS.map((g) => (
              <Link key={g.id} href={hrefWith(sp, { category: g.id })} aria-current={category === g.id ? "page" : undefined} className={chip(category === g.id)}>
                {g.label}
              </Link>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-[var(--hm-line)]" aria-hidden />
            <Link href={hrefWith(sp, { season: inSeasonOnly ? undefined : "in-season" })} aria-pressed={inSeasonOnly} className={chip(inSeasonOnly)}>
              Hide off-season
            </Link>
          </nav>
        </div>

        {products.length === 0 ? (
          <div className="mt-6 rounded-[28px] bg-[var(--hm-tint)] px-6 py-16 text-center">
            <p className="text-[17px] font-semibold">{q ? `Nothing called "${q}" yet` : "Nothing here right now"}</p>
            <p className="mt-1.5 text-[15px] text-[var(--hm-ink-2)]">Try another word, or see everything we sell.</p>
            <Link href="/shop" className="mt-5 inline-flex h-11 items-center rounded-full bg-carbon px-5 text-[14px] font-semibold text-paper-white">
              Show everything
            </Link>
          </div>
        ) : grouped ? (
          <div className="mt-6 space-y-14">
            {groups.map((g) => (
              <section key={g.id} aria-labelledby={`group-${g.id}`}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id={`group-${g.id}`} className="hm-h3 text-[1.5rem]!">
                      {g.label} <span className="font-normal text-[var(--hm-ink-3)]">{g.items.length}</span>
                    </h2>
                    <p className="mt-1 text-[15px] text-[var(--hm-ink-2)]">{g.blurb}</p>
                  </div>
                  <Link href={hrefWith(sp, { category: g.id })} className="text-[14px] font-semibold underline decoration-carbon/25 underline-offset-4 hover:decoration-carbon">
                    Only {g.label.toLowerCase()}
                  </Link>
                </div>
                <Grid products={g.items} />
              </section>
            ))}
          </div>
        ) : (
          <>
            <p className="mt-6 text-[14px] text-[var(--hm-ink-2)]" aria-live="polite">
              {products.length} {products.length === 1 ? "item" : "items"}
              {q ? ` for "${q}"` : ""}
            </p>
            <Grid products={products} />
          </>
        )}
      </div>

      {/* Where to go next: the recipes that use all this, or the account that makes it cheaper. */}
      {!user && (
        <section className="hm-wrap pb-16 sm:pb-24" aria-labelledby="shop-next">
          <h2 id="shop-next" className="sr-only">
            Next steps
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/recipes" className="group rounded-[28px] bg-[var(--hm-tint)] p-7 transition-colors hover:bg-[var(--hm-tint-2)]">
              <p className="text-[13px] font-semibold text-[var(--hm-basket-ink)]">Not sure what to buy?</p>
              <p className="hm-h3 mt-2">Start from a recipe instead.</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--hm-ink-2)]">Pick dishes you want to cook and we&apos;ll list exactly what to get, with amounts.</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold">See the recipes →</span>
            </Link>
            <Link href="/start" className="group rounded-[28px] bg-carbon p-7 text-paper-white">
              <p className="text-[13px] font-semibold text-mint-pop">Want it every week?</p>
              <p className="hm-h3 mt-2">Tell us your goal. We plan the basket.</p>
              <p className="mt-2 text-[15px] leading-relaxed text-paper-white/70">Recipes for what you&apos;re working toward and the produce for them, delivered on your day.</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold">Get started →</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Grid({ products }: { products: Product[] }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={toCardData(p)} />
      ))}
    </div>
  );
}
