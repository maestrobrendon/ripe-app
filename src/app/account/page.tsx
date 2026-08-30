import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { prisma } from "@/lib/prisma";
import {
  formatNaira,
  DELIVERY_DAY_LABEL,
  ORDER_STATUS_LABEL,
  GOAL_LABEL,
  SHOPPING_STYLE_LABEL,
} from "@/lib/format";
import { updateProfile, signOut } from "./actions";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [zones, view, orders] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { isServed: true }, orderBy: { sortOrder: "asc" } }),
    user.subscriptionTierId ? getStandingBasketView(user.id) : Promise.resolve(null),
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const prefs = user.preferences;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Your account</h1>
          <p className="mt-1 text-sm text-muted">{user.email ?? user.phone}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-full border border-border px-4 py-2 text-sm hover:bg-ripe-green-light">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-medium">Delivery details</p>
          <form action={updateProfile} className="mt-3 space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Name</span>
              <input name="name" defaultValue={user.name} className="w-full rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Address</span>
              <textarea name="address" rows={2} defaultValue={user.address ?? ""} className="w-full rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Delivery zone</span>
              <select name="zone" defaultValue={user.deliveryZone?.slug ?? ""} className="w-full rounded-lg border border-border px-3 py-2">
                <option value="">Not set</option>
                {zones.map((z) => (
                  <option key={z.slug} value={z.slug}>{z.name}</option>
                ))}
              </select>
            </label>
            <button className="rounded-full bg-ripe-green px-4 py-2 text-xs font-medium text-white">Save</button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-medium">Subscription</p>
          {user.subscriptionTier ? (
            <>
              <p className="mt-2 text-lg font-semibold">{user.subscriptionTier.name}</p>
              <p className="text-xs text-muted">
                {formatNaira(user.subscriptionTier.monthlyFee)}/mo · delivers{" "}
                {user.deliveryDay ? DELIVERY_DAY_LABEL[user.deliveryDay] : "TBC"}
              </p>
              <Link href="/subscribe" className="mt-2 inline-block text-sm text-ripe-green underline">
                Change or cancel
              </Link>
              <Link href="/basket" className="mt-1 block text-sm text-ripe-green underline">
                Edit standing basket
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm">Not subscribed.</p>
              <Link href="/subscribe" className="mt-1 inline-block text-sm text-ripe-green underline">
                See what a subscription unlocks
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Preferences</p>
          <Link href="/onboarding?next=/account" className="text-sm text-ripe-green underline">Edit</Link>
        </div>
        {prefs ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Goal</dt><dd>{prefs.primaryGoal ? GOAL_LABEL[prefs.primaryGoal] ?? prefs.primaryGoal : "Not set"}</dd></div>
            <div><dt className="text-xs text-muted">Household size</dt><dd>{prefs.householdSize ?? "Not set"}</dd></div>
            <div><dt className="text-xs text-muted">Dietary notes</dt><dd>{prefs.dietaryNotes || "None"}</dd></div>
            <div><dt className="text-xs text-muted">Shopping style</dt><dd>{prefs.shoppingStyle ? SHOPPING_STYLE_LABEL[prefs.shoppingStyle] ?? prefs.shoppingStyle : "Not set"}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">
            You have not filled these in yet. <Link href="/onboarding?next=/account" className="text-ripe-green underline">Do it now</Link>.
          </p>
        )}
      </div>

      {view && view.basket.items.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Standing basket</p>
            <Link href="/basket" className="text-sm text-ripe-green underline">Edit</Link>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {view.basket.items.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.product.imageEmoji} {i.product.name} × {i.quantity}</span>
                <span>{formatNaira(i.product.memberPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Weekly value</span>
            <span>{formatNaira(view.memberSubtotal)}</span>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium">Payment method</p>
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
          Test mode is active. No real payment method is stored yet.
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
