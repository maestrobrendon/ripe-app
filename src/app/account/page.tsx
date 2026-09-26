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
import { SHOPPING_WINDOW_DAYS } from "@/lib/shopping-window";
import { recomputeStreak } from "@/lib/streak";
import { StreakCard } from "@/components/streak-badge";
import { ProductImage } from "@/components/product-image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { TextField, TextAreaField, SelectField } from "@/components/ui/field";
import { updateProfile, updateBasketPreferences, signOut } from "./actions";

function SectionHeading({
  icon,
  title,
  action,
}: {
  icon: IconName;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon name={icon} size={18} strokeWidth={2} className="text-carbon" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="flex items-center gap-1 text-sm font-semibold text-carbon underline underline-offset-2"
        >
          <Icon name="edit" size={13} strokeWidth={2} />
          {action.label}
        </Link>
      )}
    </div>
  );
}

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
  const firstName = user.name?.trim().split(/\s+/)[0];
  const basketItems = view?.basket.items ?? [];
  const basketValue = view
    ? user.subscriptionTierId
      ? view.memberSubtotal
      : view.standardSubtotal
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
          <h1 className="text-heading-lg">{firstName ? `Hi, ${firstName}` : "Your account"}</h1>
          <p className="mt-1 text-sm text-muted">{user.email ?? user.phone}</p>
        </div>
        <form action={signOut}>
          <Button variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      {/* Snapshot: the few things worth seeing at a glance before scrolling into settings. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          variant="feature"
          tone={user.subscriptionTier ? "tint" : "surface"}
          className="lg:col-span-1 sm:col-span-2"
        >
          <div className="flex items-center gap-2 text-carbon">
            <Icon name="reward" size={18} strokeWidth={2} />
            <p className="text-xs font-semibold uppercase tracking-wide">Subscription</p>
          </div>
          {user.subscriptionTier ? (
            <>
              <p className="mt-2 text-2xl font-semibold">{user.subscriptionTier.name}</p>
              <p className="text-sm text-muted">
                {formatNaira(user.subscriptionTier.monthlyFee)}/mo · delivers{" "}
                {user.deliveryDay ? DELIVERY_DAY_LABEL[user.deliveryDay] : "TBC"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <Link href="/subscribe" className="text-sm font-semibold text-carbon underline">
                  Change or cancel
                </Link>
                <Link href="/basket" className="text-sm font-semibold text-carbon underline">
                  Edit standing basket
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-lg font-semibold">Not subscribed</p>
              <p className="text-sm text-muted">Subscribe for member pricing and a weekly streak.</p>
              <Link href="/subscribe" className="mt-3 inline-block text-sm font-semibold text-carbon underline">
                See what a subscription unlocks
              </Link>
            </>
          )}
        </Card>

        {user.subscriptionTierId && <StreakCard view={streak} />}

        {basketItems.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 text-carbon">
              <Icon name="cart" size={18} strokeWidth={2} />
              <p className="text-xs font-semibold uppercase tracking-wide">Your basket</p>
            </div>
            <p className="mt-2 text-2xl font-semibold">{formatNaira(basketValue)}</p>
            <p className="text-sm text-muted">
              {basketItems.length} {basketItems.length === 1 ? "item" : "items"} ·{" "}
              <Link href="/basket" className="font-semibold text-carbon underline">
                Edit
              </Link>
            </p>
          </Card>
        )}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Card>
          <SectionHeading icon="home" title="Delivery details" />
          <form action={updateProfile} className="mt-4 space-y-3">
            <TextField label="Name" name="name" defaultValue={user.name} />
            <TextAreaField label="Address" name="address" rows={2} defaultValue={user.address ?? ""} />
            <SelectField label="Delivery zone" name="zone" defaultValue={user.deliveryZone?.slug ?? ""}>
              <option value="">Not set</option>
              {zones.map((z) => (
                <option key={z.slug} value={z.slug}>
                  {z.name}
                </option>
              ))}
            </SelectField>
            <Button size="sm">Save</Button>
          </form>
        </Card>

        <Card>
          <SectionHeading icon="preferences" title="Preferences" action={{ href: "/onboarding?next=/account", label: "Edit" }} />
          {prefs ? (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Goal</dt>
                <dd className="font-medium">{prefs.primaryGoal ? GOAL_LABEL[prefs.primaryGoal] ?? prefs.primaryGoal : "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Household</dt>
                <dd className="font-medium">
                  {prefs.householdType ? HOUSEHOLD_TYPE_LABEL[prefs.householdType] ?? prefs.householdType : "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Weekly budget</dt>
                <dd className="font-medium">{bandById(prefs.weeklyBudgetBand)?.label ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Time to cook</dt>
                <dd className="font-medium">
                  {prefs.cookTimeAvailable ? COOK_TIME_LABEL[prefs.cookTimeAvailable] ?? prefs.cookTimeAvailable : "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Dietary notes</dt>
                <dd className="font-medium">{prefs.dietaryNotes || "None"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Shopping style</dt>
                <dd className="font-medium">
                  {prefs.shoppingStyle ? SHOPPING_STYLE_LABEL[prefs.shoppingStyle] ?? prefs.shoppingStyle : "Not set"}
                </dd>
              </div>
              {prefs.mealFormatPreference.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">Meal formats</dt>
                  <dd className="font-medium">{prefs.mealFormatPreference.map((m) => MEAL_FORMAT_LABEL[m] ?? m).join(", ")}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted">
              You have not filled these in yet.{" "}
              <Link href="/onboarding?next=/account" className="font-semibold text-carbon underline">
                Do it now
              </Link>
              .
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <SectionHeading icon="cart" title="Basket preferences" />
        <form action={updateBasketPreferences} className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-4">
            <TextField label="Adults" name="adults" type="number" min={1} max={12} defaultValue={user.householdAdults} className="w-20" />
            <TextField label="Kids" name="kids" type="number" min={0} max={12} defaultValue={user.householdKids} className="w-20" />
            <SelectField label="Basket ships" name="windowDay" defaultValue={user.shoppingWindowDay ?? ""} className="w-auto">
              <option value="">Not set</option>
              {SHOPPING_WINDOW_DAYS.map((d) => (
                <option key={d.day} value={d.day}>
                  {d.label}
                </option>
              ))}
            </SelectField>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Usually reach for</span>
            <div className="flex flex-wrap gap-2">
              {PRODUCE_PREFERENCE_OPTIONS.map((slug) => (
                <label
                  key={slug}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition has-[:checked]:bg-lavender"
                >
                  <input type="checkbox" name="produce" value={slug} defaultChecked={prefs?.producePreferences.includes(slug)} className="sr-only" />
                  {PRODUCE_PREFERENCE_LABEL[slug]}
                </label>
              ))}
            </div>
          </div>
          <Button size="sm">Save</Button>
        </form>
      </Card>

      {basketItems.length > 0 && (
        <Card className="mt-6">
          <SectionHeading icon="cart" title="Your basket" action={{ href: "/basket", label: "Edit" }} />
          <ul className="mt-4 space-y-2 text-sm">
            {basketItems.map((i) => {
              const price = user.subscriptionTierId ? i.product.memberPrice : i.product.standardPrice;
              return (
                <li key={i.id} className="flex items-center gap-2">
                  <ProductImage
                    publicId={i.product.cloudinaryPublicId}
                    alt={i.product.name}
                    emoji={i.product.imageEmoji}
                    className="h-8 w-8 shrink-0"
                    rounded="rounded-full"
                    emojiClassName="text-sm"
                    sizes="32px"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {i.product.name} × {i.quantity}
                  </span>
                  <span className="shrink-0 font-medium">{formatNaira(price * i.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Weekly value</span>
            <span>{formatNaira(basketValue)}</span>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <SectionHeading icon="payment" title="Payment method" />
        <p className="mt-3 rounded-input border border-dashed border-border p-3 text-sm text-muted">
          Test mode is active. No real payment method is stored yet.
        </p>
      </Card>

      <div className="mt-6">
        <div className="flex items-center gap-2 px-1">
          <Icon name="parcel" size={18} strokeWidth={2} className="text-carbon" />
          <p className="text-sm font-semibold">Order history</p>
        </div>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-border p-6 text-center text-sm text-muted">
            No orders yet. Once you check out, they will show up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
            {orders.map((o) => {
              const delivered = o.status === "DELIVERED";
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0">
                    <Link href={`/orders/${o.id}`} className="font-semibold text-carbon underline">
                      Order #{o.id.slice(-8)}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {o.deliveryDate.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={
                        delivered
                          ? "rounded-full bg-sky-wash px-2.5 py-1 text-xs font-semibold text-carbon"
                          : "rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted"
                      }
                    >
                      {ORDER_STATUS_LABEL[o.status]}
                    </span>
                    <span className="font-semibold">{formatNaira(o.total)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
