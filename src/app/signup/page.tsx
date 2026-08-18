import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/format";
import { createAccount } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; error?: string }>;
}) {
  const { tier: tierParam, error } = await searchParams;
  const [zones, tiers] = await Promise.all([
    prisma.zone.findMany({ orderBy: { name: "asc" } }),
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const defaultTier = tierParam ?? tiers[0]?.slug ?? "base";

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-3 text-sm text-muted">
        Lagos delivery is zone-and-day based. Pick your zone and one fixed day for your standing basket.
      </p>

      {error === "email-taken" && (
        <p className="mt-4 rounded-lg border border-ripe-terracotta bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">
          That email is already linked to another account. Use a different email, or leave it blank.
        </p>
      )}

      <form action={createAccount} className="mt-8 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Full name</label>
          <input name="name" required className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Phone number</label>
            <input name="phone" type="tel" required className="w-full rounded-lg border border-border px-3 py-2 text-sm" placeholder="080..." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email (optional)</label>
            <input name="email" type="email" className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Delivery address</label>
          <textarea name="address" required rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Delivery zone</label>
          <select name="zone" required className="w-full rounded-lg border border-border px-3 py-2 text-sm">
            {zones.map((z) => (
              <option key={z.id} value={z.slug}>
                {z.name} — {z.area}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Delivery day for your standing basket</label>
          <select name="deliveryDay" required defaultValue="MONDAY" className="w-full rounded-lg border border-border px-3 py-2 text-sm">
            <option value="MONDAY">Monday</option>
            <option value="WEDNESDAY">Wednesday</option>
            <option value="FRIDAY">Friday</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Subscription tier</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {tiers.map((tier) => (
              <label
                key={tier.id}
                className="flex cursor-pointer flex-col rounded-lg border border-border p-3 text-sm has-[:checked]:border-ripe-green has-[:checked]:bg-ripe-green-light"
              >
                <input type="radio" name="tier" value={tier.slug} defaultChecked={tier.slug === defaultTier} className="sr-only" />
                <span className="font-medium">{tier.name}</span>
                <span className="text-muted">{formatNaira(tier.monthlyFee)}/mo</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-full bg-ripe-terracotta px-6 py-3 text-sm font-medium text-white hover:bg-ripe-terracotta-dark"
        >
          Create account and start shopping
        </button>
      </form>
    </div>
  );
}
