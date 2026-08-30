import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateStandingBasket, getStandingBasketView, prefillStandingBasket } from "@/lib/basket";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import { formatNaira } from "@/lib/format";
import { BasketEditor } from "./basket-editor";

export default async function BasketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");
  if (!user.subscriptionTierId) redirect("/subscribe");

  const deliveryDay = user.deliveryDay ?? "WEDNESDAY";
  const basket = await getOrCreateStandingBasket(user.id, deliveryDay);
  const window = await getOrCreateCurrentWindow(user.id);
  await prefillStandingBasket(user.id, basket.id);

  const [view, recommended] = await Promise.all([
    getStandingBasketView(user.id),
    prisma.product.findMany({ where: { inSeason: true }, orderBy: { name: "asc" }, take: 12 }),
  ]);

  const state = windowState(window);

  const items =
    view?.basket.items.map((i) => ({
      productId: i.productId,
      slug: i.product.slug,
      name: i.product.name,
      unit: i.product.unit,
      stepQty: i.product.stepQty,
      imageEmoji: i.product.imageEmoji,
      memberPrice: i.product.memberPrice,
      standardPrice: i.product.standardPrice,
      quantity: i.quantity,
    })) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Your standing basket</h1>
      <p className="mt-1 text-sm text-muted">
        We pre-fill this each week. Add, remove or swap anything you like. You&rsquo;re only charged for
        what&rsquo;s in it when the window closes.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-sm">
        {state.skipped ? (
          <span className="font-medium text-ripe-terracotta-dark">You&rsquo;ve skipped this week.</span>
        ) : state.locked ? (
          <span className="font-medium text-ripe-terracotta-dark">This week&rsquo;s window is closed.</span>
        ) : (
          <span className="font-medium text-ripe-green">
            Window closes in {state.hoursLeft} hours
          </span>
        )}
        <span className="text-muted">
          Closes {window.closesAt.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" })}
        </span>
        <span className="ml-auto">
          <span className="text-muted">Running value </span>
          <span className="font-semibold">{formatNaira(view?.memberSubtotal ?? 0)}</span>
          {view && view.savings > 0 && (
            <span className="ml-2 text-xs text-ripe-terracotta-dark">
              saving {formatNaira(view.savings)} vs non-member
            </span>
          )}
        </span>
      </div>

      <div className="mt-8">
        <BasketEditor
          items={items}
          deliveryDay={deliveryDay}
          locked={state.locked || state.skipped}
          skipped={state.skipped}
          recommended={recommended.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            unit: p.unit,
            minOrderQty: p.minOrderQty,
            imageEmoji: p.imageEmoji,
            memberPrice: p.memberPrice,
            standardPrice: p.standardPrice,
          }))}
        />
      </div>

      <p className="mt-8 rounded-xl border border-dashed border-border p-4 text-xs text-muted">
        Known gap (phase 2): windows are opened and charged on a schedule in production. For now the
        window is created when you visit this page and no real charge is taken.
      </p>
    </div>
  );
}
