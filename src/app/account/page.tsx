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
  HOUSEHOLD_TYPE_LABEL,
  COOK_TIME_LABEL,
  MEAL_FORMAT_LABEL,
  PRODUCE_PREFERENCE_LABEL,
  PRODUCE_PREFERENCE_OPTIONS,
} from "@/lib/format";
import { bandById } from "@/lib/budget";
import { SHOPPING_WINDOW_DAYS, SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import { recomputeStreak } from "@/lib/streak";
import { StreakCard } from "@/components/streak-badge";
import { ProductImage } from "@/components/product-image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateProfile, updateBasketPreferences, signOut } from "./actions";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [zones, view, orders, streak] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { isServed: true }, orderBy: { sortOrder: "asc" } }),
    getStandingBasketView(user.id),
    prisma.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    recomputeStreak(user.id),
  ]);

  const prefs = user.preferences;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading">Your account</h1>
          <p className="mt-1 text-sm text-muted">{user.email ?? user.phone}</p>
        </div>
        <form action={signOut}>
          <Button variant="secondary" size="sm">Sign out</Button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-medium">Delivery details</p>
          <form action={updateProfile} className="mt-3 space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Name</span>
              <input name="name" defaultValue={user.name} className="w-full rounded-input border border-border px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Address</span>
              <textarea name="address" rows={2} defaultValue={user.address ?? ""} className="w-full rounded-input border border-border px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Delivery zone</span>
              <select name="zone" defaultValue={user.deliveryZone?.slug ?? ""} className="w-full rounded-input border border-border px-3 py-2">
                <option value="">Not set</option>
                {zones.map((z) => (
                  <option key={z.slug} value={z.slug}>{z.name}</option>
                ))}
              </select>
            </label>
            <Button size="sm">Save</Button>
          </form>
        </Card>

        <Card>
          <p className="text-sm font-medium">Subscription</p>
          {user.subscriptionTier ? (
            <>
              <p className="mt-2 text-lg font-semibold">{user.subscriptionTier.name}</p>
              <p className="text-xs text-muted">
                {formatNaira(user.subscriptionTier.monthlyFee)}/mo · delivers{" "}
                {user.deliveryDay ? DELIVERY_DAY_LABEL[user.deliveryDay] : "TBC"}
              </p>
              <Link href="/subscribe" className="mt-2 inline-block text-sm text-basket-green underline">
                Change or cancel
              </Link>
              <Link href="/basket" className="mt-1 block text-sm text-basket-green underline">
                Edit standing basket
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm">Not subscribed.</p>
              <Link href="/subscribe" className="mt-1 inline-block text-sm text-basket-green underline">
                See what a subscription unlocks
              </Link>
            </>
          )}
        </Card>
      </div>

      {user.subscriptionTierId && (
        <div className="mt-8">
          <StreakCard view={streak} />
        </div>
      )}

      <Card className="mt-8">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Preferences</p>
          <Link href="/onboarding?next=/account" className="text-sm text-basket-green underline">Edit</Link>
        </div>
        {prefs ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Goal</dt><dd>{prefs.primaryGoal ? GOAL_LABEL[prefs.primaryGoal] ?? prefs.primaryGoal : "Not set"}</dd></div>
            <div><dt className="text-xs text-muted">Household</dt><dd>{prefs.householdType ? HOUSEHOLD_TYPE_LABEL[prefs.householdType] ?? prefs.householdType : "Not set"}</dd></div>
            <div><dt className="text-xs text-muted">Weekly budget</dt><dd>{bandById(prefs.weeklyBudgetBand)?.label ?? "Not set"}</dd></div>
            <div><dt className="text-xs text-muted">Time to cook</dt><dd>{prefs.cookTimeAvailable ? COOK_TIME_LABEL[prefs.cookTimeAvailable] ?? prefs.cookTimeAvailable : "Not set"}</dd></div>
            <div><dt className="text-xs text-muted">Dietary notes</dt><dd>{prefs.dietaryNotes || "None"}</dd></div>
            <div><dt className="text-xs text-muted">Shopping style</dt><dd>{prefs.shoppingStyle ? SHOPPING_STYLE_LABEL[prefs.shoppingStyle] ?? prefs.shoppingStyle : "Not set"}</dd></div>
            {prefs.mealFormatPreference.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Meal formats</dt>
                <dd>{prefs.mealFormatPreference.map((m) => MEAL_FORMAT_LABEL[m] ?? m).join(", ")}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">
            You have not filled these in yet. <Link href="/onboarding?next=/account" className="text-basket-green underline">Do it now</Link>.
          </p>
        )}
      </Card>

      <Card className="mt-8">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Basket preferences</p>
        </div>
        <form action={updateBasketPreferences} className="mt-3 space-y-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Adults</span>
              <input
                name="adults"
                type="number"
                min={1}
                max={12}
                defaultValue={user.householdAdults}
                className="w-20 rounded-input border border-border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Kids</span>
              <input
                name="kids"
                type="number"
                min={0}
                max={12}
                defaultValue={user.householdKids}
                className="w-20 rounded-input border border-border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Basket ships</span>
              <select
                name="windowDay"
                defaultValue={user.shoppingWindowDay ?? ""}
                className="rounded-input border border-border px-3 py-2"
              >
                <option value="">Not set</option>
                {SHOPPING_WINDOW_DAYS.map((d) => (
                  <option key={d.day} value={d.day}>{d.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Usually reach for</span>
            <div className="flex flex-wrap gap-2">
              {PRODUCE_PREFERENCE_OPTIONS.map((slug) => (
                <label
                  key={slug}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 has-[:checked]:border-basket-green has-[:checked]:bg-basket-green-light"
                >
                  <input
                    type="checkbox"
                    name="produce"
                    value={slug}
                    defaultChecked={prefs?.producePreferences.includes(slug)}
                  />
                  {PRODUCE_PREFERENCE_LABEL[slug]}
                </label>
              ))}
            </div>
          </div>
          <Button size="sm">Save</Button>
        </form>
      </Card>

      {view && view.basket.items.length > 0 && (
        <Card className="mt-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Your basket</p>
            <Link href="/basket" className="text-sm text-basket-green underline">Edit</Link>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {view.basket.items.map((i) => {
              const price = user.subscriptionTierId ? i.product.memberPrice : i.product.standardPrice;
              return (
                <li key={i.id} className="flex items-center gap-2">
                  <ProductImage
                    publicId={i.product.cloudinaryPublicId}
                    alt={i.product.name}
                    emoji={i.product.imageEmoji}
                    className="h-7 w-7 shrink-0"
                    rounded="rounded-md"
                    emojiClassName="text-sm"
                    sizes="28px"
                  />
                  <span className="min-w-0 flex-1 truncate">{i.product.name} × {i.quantity}</span>
                  <span className="shrink-0">{formatNaira(price * i.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Weekly value</span>
            <span>
              {formatNaira(user.subscriptionTierId ? view.memberSubtotal : view.standardSubtotal)}
            </span>
          </div>
        </Card>
      )}

      <Card className="mt-8">
        <p className="mb-3 text-sm font-medium">Payment method</p>
        <p className="rounded-input border border-dashed border-border p-3 text-sm text-muted">
          Test mode is active. No real payment method is stored yet.
        </p>
      </Card>

      <div className="mt-8">
        <p className="mb-3 text-sm font-medium">Order history</p>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <Link href={`/orders/${o.id}`} className="font-medium text-basket-green underline">
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
