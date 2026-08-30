import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira, CATEGORY_LABEL } from "@/lib/format";
import { ProductCard } from "@/components/product-card";
import { ProductGrid } from "@/components/product-grid";
import { SearchBar } from "@/components/search-bar";
import { FaqBand } from "@/components/faq-band";
import { toCardData, FRESH_CUTS_TAG } from "@/lib/product";
import type { Prisma } from "@/generated/prisma/client";

const COLLECTIONS: { title: string; href: string; blurb: string; where: Prisma.ProductWhereInput }[] = [
  { title: CATEGORY_LABEL.BOX_BUNDLE, href: "/boxes-baskets", blurb: "Pre-picked mixes for a week of meals.", where: { category: "BOX_BUNDLE" } },
  { title: "Fresh Cuts", href: "/fresh-cuts", blurb: "Pre-cut and ready to eat.", where: { tags: { has: FRESH_CUTS_TAG } } },
  { title: CATEGORY_LABEL.FRUIT, href: "/fruits", blurb: "Picked days before it reaches your door.", where: { category: "FRUIT" } },
  { title: CATEGORY_LABEL.SEASONAL, href: "/shop?category=SEASONAL", blurb: "Only around for a few weeks.", where: { category: "SEASONAL" } },
];

const TESTIMONIALS = [
  { quote: "The produce actually lasts the week. That never happened with the market.", name: "Adaeze, Lekki" },
  { quote: "I subscribed after the second order. Free delivery on my day pays for itself.", name: "Tunde, Yaba" },
  { quote: "Ordering one box a week has made us eat far more vegetables.", name: "Ifeoma, Ikeja" },
];

export default async function LandingPage() {
  const [featured, tiers, ...collectionProducts] = await Promise.all([
    prisma.product.findMany({ where: { featured: true }, take: 8, orderBy: { name: "asc" } }),
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } }),
    ...COLLECTIONS.map((c) =>
      prisma.product.findMany({ where: c.where, take: 4, orderBy: { name: "asc" } }),
    ),
  ]);

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-12 sm:px-6 sm:pt-20">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          What are you shopping for today?
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
          Fruits and vegetables sourced locally from trusted farmers, delivered
          across Lagos. No subscription needed to shop.
        </p>
        <div className="mt-6 max-w-md">
          <SearchBar />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/shop" className="font-medium text-ripe-green underline">Browse everything</Link>
          <span className="text-muted">·</span>
          <Link href="/subscribe" className="font-medium text-ripe-green underline">See subscription perks</Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Favorites</h2>
            <Link href="/shop" className="text-sm text-ripe-green underline">View all</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featured.map((p) => (
              <div key={p.id} className="w-[220px] shrink-0">
                <ProductCard product={toCardData(p)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {COLLECTIONS.map((c, idx) => {
        const items = collectionProducts[idx];
        if (!items || items.length === 0) return null;
        return (
          <section key={c.title} className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{c.title}</h2>
                <p className="text-sm text-muted">{c.blurb}</p>
              </div>
              <Link href={c.href} className="text-sm text-ripe-green underline">View all</Link>
            </div>
            <ProductGrid products={items} />
          </section>
        );
      })}

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              ["Choose your produce", "Browse the shop and build your cart, by the piece, the pair, or the kilo."],
              ["We pick and pack", "Your order is sourced from partner farms and packed the morning it goes out."],
              ["Delivered to you", "It arrives in your delivery window, anywhere we cover in Lagos."],
            ].map(([title, body], i) => (
              <div key={title}>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ripe-green text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 text-center sm:grid-cols-3">
          {[
            ["🧺", "Hand-picked quality", "Every order is checked by a person before it leaves."],
            ["🚚", "Fast, reliable delivery", "Fixed delivery windows across the zones we cover."],
            ["🌱", "Trusted by thousands", "Households across Lagos order from Ripe every week."],
          ].map(([emoji, title, body]) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="text-3xl">{emoji}</div>
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-ripe-green-light/50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-semibold">What customers say</h2>
          <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="w-[300px] shrink-0 rounded-2xl bg-surface p-6">
                <blockquote className="text-sm">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-3 text-xs font-medium text-muted">{t.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl bg-ripe-green p-8 text-white sm:p-12">
          <h2 className="text-2xl font-semibold">Order often? Subscribe.</h2>
          <p className="mt-3 max-w-xl text-sm text-white/80">
            A Ripe subscription unlocks member pricing across the catalog, free delivery on your set
            days, combo pricing, and a standing weekly basket you edit before you are charged.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {tiers.map((t) => (
              <span key={t.id} className="rounded-full bg-white/15 px-4 py-2 text-sm">
                {t.name} · {formatNaira(t.monthlyFee)}/mo
              </span>
            ))}
          </div>
          <Link
            href="/subscribe"
            className="mt-6 inline-block rounded-full bg-white px-6 py-3 text-sm font-medium text-ripe-green hover:bg-white/90"
          >
            Compare subscriptions
          </Link>
        </div>
      </section>

      <FaqBand />
    </div>
  );
}
