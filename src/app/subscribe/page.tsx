import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatNaira, DELIVERY_DAY_LABEL } from "@/lib/format";
import { startSubscription } from "./actions";
import { TierControls } from "./tier-controls";

const DAYS = ["MONDAY", "WEDNESDAY", "FRIDAY"] as const;

export default async function SubscribePage() {
  const [tiers, user] = await Promise.all([
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } }),
    getCurrentUser(),
  ]);

  const currentSlug = user?.subscriptionTier?.slug ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-ripe-terracotta-dark">Optional upgrade</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
          Subscribe for member pricing and a standing basket
        </h1>
        <p className="mt-4 text-sm text-muted">
          You can shop Ripe with no subscription at all. A subscription is an upgrade on top of your
          account. It unlocks member pricing across the catalog, free delivery on your set days, combo
          pricing on boxes, and a standing weekly basket you edit before you are charged.
        </p>
        <Link href="/shop" className="mt-4 inline-block text-sm font-medium text-ripe-green underline">
          Or just start shopping
        </Link>
      </div>

      {currentSlug ? (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-ripe-green bg-ripe-green-light p-6 text-center">
          <p className="text-sm text-muted">You are subscribed to</p>
          <p className="text-2xl font-semibold">{user?.subscriptionTier?.name}</p>
          <p className="mt-1 text-sm text-muted">
            Delivering {user?.deliveryDay ? DELIVERY_DAY_LABEL[user.deliveryDay] : "on a day you choose"}
          </p>
          <TierControls tiers={tiers.map((t) => ({ slug: t.slug, name: t.name }))} currentSlug={currentSlug} />
        </div>
      ) : null}

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {tiers.map((tier, i) => {
          const isMid = i === 1;
          const isCurrent = tier.slug === currentSlug;
          return (
            <div
              key={tier.id}
              className={`flex flex-col rounded-2xl border p-6 ${
                isMid ? "border-ripe-green bg-ripe-green-light" : "border-border bg-surface"
              }`}
            >
              {isMid && (
                <span className="mb-3 inline-block w-fit rounded-full bg-ripe-green px-3 py-1 text-xs font-medium text-white">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-1 text-3xl font-semibold">
                {formatNaira(tier.monthlyFee)}
                <span className="text-sm font-normal text-muted">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted">{tier.tagline}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span className="text-ripe-green">✓</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <p className="mt-6 rounded-full border border-border px-4 py-2.5 text-center text-sm font-medium text-muted">
                  Your current plan
                </p>
              ) : !user ? (
                <Link
                  href={`/signup?next=${encodeURIComponent("/subscribe")}`}
                  className={`mt-6 rounded-full px-4 py-2.5 text-center text-sm font-medium ${
                    isMid ? "bg-ripe-green text-white" : "border border-ripe-green text-ripe-green"
                  }`}
                >
                  Create an account to subscribe
                </Link>
              ) : (
                <form action={startSubscription} className="mt-6 space-y-2">
                  <input type="hidden" name="tier" value={tier.slug} />
                  <select name="deliveryDay" className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                    {DAYS.map((d) => (
                      <option key={d} value={d}>Deliver {DELIVERY_DAY_LABEL[d]}</option>
                    ))}
                  </select>
                  <button
                    className={`w-full rounded-full px-4 py-2.5 text-sm font-medium ${
                      isMid ? "bg-ripe-green text-white hover:bg-ripe-green-dark" : "border border-ripe-green text-ripe-green hover:bg-ripe-green-light"
                    }`}
                  >
                    {currentSlug ? `Switch to ${tier.name}` : `Start ${tier.name}`}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
