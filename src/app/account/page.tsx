import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { prisma } from "@/lib/prisma";
import { formatNaira, DELIVERY_DAY_LABEL, ORDER_STATUS_LABEL } from "@/lib/format";
import { currentWeekStart } from "@/lib/weeks";
import { TierControl, SkipWeekButton } from "./account-controls";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/subscribe");

  const [tiers, view, orders, skipped] = await Promise.all([
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" } }),
    getStandingBasketView(user.id),
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.skippedWeek.findUnique({ where: { userId_weekStart: { userId: user.id, weekStart: currentWeekStart() } } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Your account</h1>
      <p className="mt-1 text-sm text-muted">{user.name} · {user.zone.name}</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">Subscription tier</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-semibold">{user.subscriptionTier.name}</span>
            <TierControl tiers={tiers.map((t) => ({ slug: t.slug, name: t.name }))} currentTierSlug={user.subscriptionTier.slug} />
          </div>
          <p className="mt-2 text-xs text-muted">{formatNaira(user.subscriptionTier.monthlyFee)}/mo</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">This week&rsquo;s delivery</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-semibold">{DELIVERY_DAY_LABEL[user.deliveryDay]}</span>
            <SkipWeekButton isSkipped={Boolean(skipped)} />
          </div>
          {skipped && <p className="mt-2 text-xs text-ripe-terracotta-dark">Your basket won&apos;t be delivered this week.</p>}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Standing basket</p>
          <Link href="/basket" className="text-sm text-ripe-green underline">Edit</Link>
        </div>
        {view && view.basket.items.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">
            {view.basket.items.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.product.imageEmoji} {i.product.name} × {i.quantity}</span>
                <span>{formatNaira(i.product.memberPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Your basket is empty.</p>
        )}
        {view && view.basket.items.length > 0 && (
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Weekly value</span>
            <span>{formatNaira(view.memberSubtotal)}</span>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium">Payment method</p>
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
          Test mode is active — no real payment method is stored yet.
        </p>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-sm font-medium">Order history</p>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <Link href={`/orders/${o.id}`} className="font-medium text-ripe-green underline">
                    Order #{o.id.slice(-8)}
                  </Link>
                  <p className="text-xs text-muted">
                    {o.deliveryDate.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · {ORDER_STATUS_LABEL[o.status]}
                  </p>
                </div>
                <span className="font-medium">{formatNaira(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
