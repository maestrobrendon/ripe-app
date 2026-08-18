import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/format";

export default async function SubscribePage() {
  const tiers = await prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">Choose your subscription</h1>
        <p className="mt-4 text-sm text-muted">
          Your subscription is separate from the cost of produce. It unlocks member pricing, delivery
          perks, and combo pricing. You&rsquo;ll build your actual basket after this.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {tiers.map((tier, i) => {
          const isMid = i === 1;
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
              <Link
                href={`/signup?tier=${tier.slug}`}
                className={`mt-6 rounded-full px-4 py-2.5 text-center text-sm font-medium ${
                  isMid
                    ? "bg-ripe-green text-white hover:bg-ripe-green-dark"
                    : "border border-ripe-green text-ripe-green hover:bg-ripe-green-light"
                }`}
              >
                Select {tier.name}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
