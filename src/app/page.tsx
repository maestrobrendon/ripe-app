import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/format";

export default async function LandingPage() {
  const [tiers, featured] = await Promise.all([
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ where: { featured: true }, take: 4 }),
  ]);

  const marketTotal = featured.reduce((s, p) => s + p.marketPrice, 0);
  const ripeTotal = featured.reduce((s, p) => s + p.memberPrice, 0);

  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-ripe-terracotta-dark">
              Lagos · Farm-direct · Subscription
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Fruits and vegetables, curated for health.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted sm:text-lg">
              Ripe is a subscription that unlocks member pricing on produce sourced straight from
              farmers in Ogun, Oyo and Ondo states. You build your own basket, pick a delivery day,
              and let it repeat every week.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/subscribe"
                className="rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark"
              >
                Choose your subscription
              </Link>
              <Link
                href="/about"
                className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-ripe-green-light"
              >
                Why farm-direct
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {["🥭", "🍅", "🥑", "🥬"].map((emoji, i) => (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-3xl bg-ripe-green-light text-7xl"
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ripe-green text-sm font-semibold text-white">1</div>
              <h3 className="font-medium">Subscribe</h3>
              <p className="mt-2 text-sm text-muted">
                Pick Base, Mid or Premium. Your tier sets your member pricing and delivery perks.
              </p>
            </div>
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ripe-green text-sm font-semibold text-white">2</div>
              <h3 className="font-medium">Build your basket</h3>
              <p className="mt-2 text-sm text-muted">
                Pick fruits, vegetables and combos, set quantities, and choose your weekly delivery day.
              </p>
            </div>
            <div>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ripe-green text-sm font-semibold text-white">3</div>
              <h3 className="font-medium">Get guided by the trained assistant</h3>
              <p className="mt-2 text-sm text-muted">
                Tell it a goal, or let it read your basket, for practical ideas on what to make.
              </p>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid items-center gap-8 rounded-3xl bg-ripe-green-light p-8 sm:p-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold">Market price vs. Ripe price</h2>
              <p className="mt-3 text-sm text-muted">
                Cutting out the middlemen between farm and door means real savings, not just a promise.
                Here&rsquo;s what four staples cost at a Lagos supermarket, compared to Ripe member pricing.
              </p>
              <Link
                href="/shop"
                className="mt-6 inline-block rounded-full bg-ripe-green px-6 py-3 text-sm font-medium text-white hover:bg-ripe-green-dark"
              >
                Browse the shop
              </Link>
            </div>
            <div className="rounded-2xl bg-surface p-6">
              <ul className="space-y-3">
                {featured.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">{p.imageEmoji}</span> {p.name}
                    </span>
                    <span>
                      <span className="text-muted line-through">{formatNaira(p.marketPrice)}</span>{" "}
                      <span className="font-medium">{formatNaira(p.memberPrice)}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm font-semibold">
                <span>Total</span>
                <span>
                  <span className="text-muted line-through">{formatNaira(marketTotal)}</span>{" "}
                  {formatNaira(ripeTotal)}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold">Subscription tiers</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {tiers.map((tier) => (
            <div key={tier.id} className="flex flex-col rounded-2xl border border-border bg-surface p-6">
              <h3 className="font-medium">{tier.name}</h3>
              <p className="mt-1 text-2xl font-semibold">{formatNaira(tier.monthlyFee)}<span className="text-sm font-normal text-muted">/mo</span></p>
              <p className="mt-2 text-sm text-muted">{tier.tagline}</p>
              <Link
                href="/subscribe"
                className="mt-6 rounded-full border border-ripe-green px-4 py-2 text-center text-sm font-medium text-ripe-green hover:bg-ripe-green-light"
              >
                Select {tier.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="rounded-3xl bg-ripe-terracotta-light p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold">Not trying to replace anyone</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
            Ripe isn&apos;t here to replace Chowdeck, the roadside seller, or the supermarket. It&apos;s for
            people who already want to eat better, and want a service built to make that consistent.
          </p>
          <Link href="/about" className="mt-6 inline-block text-sm font-medium text-ripe-terracotta-dark underline">
            Read the full story
          </Link>
        </div>
      </section>
    </div>
  );
}
