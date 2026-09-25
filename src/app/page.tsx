import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira, CATEGORY_LABEL } from "@/lib/format";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { ProductCard } from "@/components/product-card";
import { ProductGrid } from "@/components/product-grid";
import { ProductImage } from "@/components/product-image";
import { SearchBar } from "@/components/search-bar";
import { FaqBand } from "@/components/faq-band";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BasketEstimator } from "@/components/basket-estimator";
import { getHeroBasketCandidates } from "@/lib/starter-basket";
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
  const [featured, tiers, starterCandidates, ...collectionProducts] = await Promise.all([
    prisma.product.findMany({ where: { featured: true }, take: 8, orderBy: { name: "asc" } }),
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } }),
    getHeroBasketCandidates(),
    ...COLLECTIONS.map((c) =>
      prisma.product.findMany({ where: c.where, take: 4, orderBy: { name: "asc" } }),
    ),
  ]);

  return (
    <div>
      {/* Hero: copy on the left, a live basket estimator on the right. The
          header sits on this same band so the nav and hero read as one field. */}
      <section className="bg-basket-green-light">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 sm:pb-20 lg:grid-cols-[1.05fr_minmax(380px,1fr)] lg:gap-14">
          <div>
            <h1 className="text-display text-basket-green-dark">
              Fruits and vegetables, delivered across Lagos
            </h1>
            <p className="mt-5 max-w-xl text-base text-basket-green-dark/80 sm:text-lg">
              Sourced locally from trusted farmers and checked by hand before it leaves us.
            </p>

            <ul className="mt-7 space-y-3">
              {[
                "No subscription needed to shop",
                "Pick the day it ships: Thursday, Friday or Saturday",
                "Nothing is charged automatically, ever",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-basket-green-dark">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-basket-green text-xs font-bold text-white"
                  >
                    ✓
                  </span>
                  <span className="text-sm sm:text-base">{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <LinkButton href="/start" size="lg">Create your account</LinkButton>
              <LinkButton href="/shop" variant="ghost">Browse everything</LinkButton>
            </div>

            <div className="mt-8 max-w-md">
              <SearchBar />
            </div>
          </div>

          <BasketEstimator candidates={starterCandidates} />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-heading-sm">Favorites</h2>
            <Link href="/shop" className="text-sm text-basket-green underline">View all</Link>
          </div>
          <div className="snap-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0">
            {featured.map((p) => (
              <div key={p.id} className="w-[44vw] max-w-[190px] shrink-0 sm:w-[220px] sm:max-w-none">
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
                <h2 className="text-heading-sm">{c.title}</h2>
                <p className="text-sm text-muted">{c.blurb}</p>
              </div>
              <Link href={c.href} className="text-sm text-basket-green underline">View all</Link>
            </div>
            <ProductGrid products={items} />
          </section>
        );
      })}

      <section className="bg-basket-green">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-heading text-white">How it works</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              ["Choose your produce", "Browse the shop and build your cart, by the piece, the pair, or the kilo."],
              ["We pick and pack", "Your order is sourced from partner farms and packed the morning it goes out."],
              ["Delivered to you", "It arrives in your delivery window, anywhere we cover in Lagos."],
            ].map(([title, body], i) => (
              <div key={title}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-base font-bold text-basket-green">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-white/70">{body}</p>
              </div>
            ))}
          </div>
          <LinkButton href="/start" size="lg" className="mt-10 bg-white! text-basket-green! hover:bg-white/90!">
            Create your free account
          </LinkButton>
        </div>
      </section>

      {/* Alternating text/visual blocks: the trust argument, then the two ways
          to shop, framed as side-by-side cards. */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-heading">Nothing is charged automatically</h2>
            <p className="mt-4 text-base text-muted">
              Your basket sits saved to your account, and you edit it whenever you like. Picking a
              shipping day sets which day it would go out. It does not start a countdown and it does
              not authorise a payment.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "The basket stays open and editable for as long as you want",
                "Checking out yourself is the only thing that places an order",
                "No scheduled charge runs in the background, on any plan",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 text-basket-green">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <LinkButton href="/start" variant="ghost" className="mt-6">
              See how the basket works
            </LinkButton>
          </div>

          {featured.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {featured.slice(0, 4).map((p) => (
                <ProductImage
                  key={p.id}
                  publicId={p.cloudinaryPublicId}
                  alt={p.name}
                  emoji={p.imageEmoji}
                  className="aspect-square w-full"
                  rounded="rounded-card"
                  emojiClassName="text-5xl"
                  sizes="(min-width: 1024px) 240px, 45vw"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-heading">Two ways to shop</h2>
          <p className="mt-3 max-w-xl text-muted">
            Both use the same catalogue and the same produce. The difference is only how you pay.
          </p>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {[
              {
                title: "Order when you want it",
                body: "Build a cart, check out, done. No account subscription, no commitment, standard pricing.",
                points: [
                  "Pay per order",
                  `Delivery free over ${formatNaira(FREE_DELIVERY_THRESHOLD)}`,
                  "No monthly fee",
                ],
                href: "/shop",
                cta: "Start shopping",
                primary: true,
              },
              {
                title: "Keep a standing basket",
                body: "Save a basket to your account and adjust it week to week. Subscribe on top for member pricing.",
                points: ["Member pricing across the catalogue", "Free delivery on your day", "Edit or skip any week"],
                href: "/subscribe",
                cta: "Compare subscriptions",
                primary: false,
              },
            ].map((opt) => (
              <Card key={opt.title} variant="feature" className="flex flex-col">
                <h3 className="text-heading-sm">{opt.title}</h3>
                <p className="mt-3 text-sm text-muted">{opt.body}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {opt.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden className="text-basket-green">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <LinkButton
                  href={opt.href}
                  variant={opt.primary ? "primary" : "secondary"}
                  className="mt-6 w-full"
                >
                  {opt.cta}
                </LinkButton>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 text-center sm:grid-cols-3">
          {[
            ["🧺", "Hand-picked quality", "Every order is checked by a person before it leaves."],
            ["🚚", "Fast, reliable delivery", "Fixed delivery windows across the zones we cover."],
            ["🌱", "Trusted by thousands", "Households across Lagos order from Basket every week."],
          ].map(([emoji, title, body]) => (
            <Card key={title}>
              <div className="text-3xl">{emoji}</div>
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-basket-green-light/50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-heading-sm">What customers say</h2>
          <div className="snap-row -mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="w-[80vw] max-w-[300px] shrink-0 rounded-card bg-surface p-6 sm:w-[300px]">
                <blockquote className="text-sm">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-3 text-xs font-medium text-muted">{t.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Card variant="feature" className="bg-basket-green text-white">
          <h2 className="text-heading-sm">Order often? Subscribe.</h2>
          <p className="mt-3 max-w-xl text-sm text-white/80">
            A Basket subscription unlocks member pricing across the catalog, free delivery on your set
            days, combo pricing, and a standing weekly basket you edit before you are charged.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {tiers.map((t) => (
              <span key={t.id} className="rounded-full bg-white/15 px-4 py-2 text-sm">
                {t.name} · {formatNaira(t.monthlyFee)}/mo
              </span>
            ))}
          </div>
          <LinkButton href="/subscribe" className="mt-6 bg-white! text-basket-green! hover:bg-white/90!">
            Compare subscriptions
          </LinkButton>
        </Card>
      </section>

      <FaqBand />
    </div>
  );
}
