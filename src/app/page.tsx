import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira, CATEGORY_LABEL } from "@/lib/format";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { ProductCard } from "@/components/product-card";
import { ProductGrid } from "@/components/product-grid";
import { ProductImage } from "@/components/product-image";
import { FaqBand } from "@/components/faq-band";
import { LinkButton } from "@/components/ui/button";
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

/** Brand photography in Cloudinary, uploaded via prisma/scripts/upload-brand-image.ts. */
const HERO_IMAGE_ID = "basket-hero-produce-bag";

const iconProps = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

// Every line here states something the app actually does. Volume claims stay
// off until there are real numbers behind them.
const FEATURES = [
  {
    title: "Checked by a person",
    body: "Every order is looked over by hand before it leaves us, and replaced if it is not right.",
    Icon: () => (
      <svg {...iconProps} className="text-basket-green">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    ),
  },
  {
    title: "Fixed delivery days",
    body: "Each zone has set days with a 9am to 5pm window, and you pick the one that suits you.",
    Icon: () => (
      <svg {...iconProps} className="text-basket-green">
        <path d="M3 16V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v9" />
        <path d="M15 10h3.5l2.5 3.2V16h-2" />
        <circle cx="7.5" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </svg>
    ),
  },
  {
    title: "Sourced locally",
    body: "Fruit and vegetables bought from farmers we work with directly, not a wholesale floor.",
    Icon: () => (
      <svg {...iconProps} className="text-basket-green">
        <path d="M12 20v-8" />
        <path d="M12 12c0-3.5-2.7-6-6.5-6 0 3.5 2.7 6 6.5 6z" />
        <path d="M12 12c0-2.8 2.2-5 5.5-5 0 2.8-2.2 5-5.5 5z" />
      </svg>
    ),
  },
];

export default async function LandingPage() {
  const [featured, starterCandidates, ...collectionProducts] = await Promise.all([
    prisma.product.findMany({ where: { featured: true }, take: 8, orderBy: { name: "asc" } }),
    getHeroBasketCandidates(),
    ...COLLECTIONS.map((c) =>
      prisma.product.findMany({ where: c.where, take: 4, orderBy: { name: "asc" } }),
    ),
  ]);

  return (
    <div>
      {/* Hero: short claim, three proof points, one action, one photograph.
          The header shares this band so nav and hero read as one field, and
          the grid is height-capped so the whole thing lands above the fold. */}
      <section className="bg-basket-green-light">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:min-h-[calc(100svh-7rem)] lg:grid-cols-2 lg:gap-16 lg:py-14">
          <div>
            <h1 className="text-display text-basket-green-dark">
              Fresh produce, delivered across Lagos
            </h1>

            <ul className="mt-8 space-y-4">
              {[
                "Locally sourced, checked by hand",
                "Ships Thursday, Friday or Saturday",
                "Nothing is charged automatically",
              ].map((point) => (
                <li key={point} className="flex items-center gap-3 text-basket-green-dark">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-basket-green text-xs font-bold text-white"
                  >
                    ✓
                  </span>
                  <span className="text-base sm:text-lg">{point}</span>
                </li>
              ))}
            </ul>

            <LinkButton href="/start" size="lg" className="mt-10">
              Get started
            </LinkButton>
          </div>

          <ProductImage
            publicId={HERO_IMAGE_ID}
            alt="Unpacking a Basket delivery of oranges, bananas, peppers and greens"
            emoji="🧺"
            aspectRatio="4:3"
            className="aspect-[4/3] w-full"
            rounded="rounded-card-lg"
            emojiClassName="text-8xl"
            sizes="(min-width: 1024px) 560px, 90vw"
          />
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
              ["Choose your produce", "By the piece, the pair, or the kilo."],
              ["We pick and pack", "Packed the morning it goes out."],
              ["Delivered to you", "Anywhere we cover in Lagos."],
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
            Get started
          </LinkButton>
        </div>
      </section>

      {/* The trust argument, kept to one claim and three proofs. */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-heading">Nothing is charged automatically</h2>
            <p className="mt-4 text-base text-muted">
              Your basket stays saved and editable. Picking a day sets when it would ship, nothing more.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Edit it whenever you like",
                "Checking out is what places the order",
                "No scheduled charge, on any plan",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 text-basket-green">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
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

      {/* Pricing, answered with a real basket instead of a comparison table. */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-heading">What a week costs</h2>
            <p className="mt-4 text-base text-muted">
              Set your household and see a real basket, priced both ways. Delivery is free over{" "}
              {formatNaira(FREE_DELIVERY_THRESHOLD)}, or on every member order.
            </p>
            <LinkButton href="/subscribe" variant="ghost" className="mt-6">
              Compare subscriptions
            </LinkButton>
          </div>

          <BasketEstimator candidates={starterCandidates} />
        </div>
      </section>

      {/* Trust signals as bare columns: stroke icon, heading, one line. No
          card, border or shadow, so the type and spacing carry the section. */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-3 sm:gap-10">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title}>
              <Icon />
              <h3 className="mt-6 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-base text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <FaqBand />
    </div>
  );
}
