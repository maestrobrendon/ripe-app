import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateStandingBasket, getStandingBasketView, prefillStandingBasket } from "@/lib/basket";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import {
  computeCumulativeSavings,
  computeGoalFit,
  getQuickAddItems,
  getFlaggedSwaps,
} from "@/lib/basket-hub";
import { recomputeStreak } from "@/lib/streak";
import { formatNaira } from "@/lib/format";
import { StreakCard } from "@/components/streak-badge";
import { BasketWorkspace } from "./basket-workspace";

export default async function BasketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");
  if (!user.subscriptionTierId) redirect("/subscribe");

  const deliveryDay = user.deliveryDay ?? "WEDNESDAY";
  const basket = await getOrCreateStandingBasket(user.id, deliveryDay);
  const window = await getOrCreateCurrentWindow(user.id);
  await prefillStandingBasket(user.id, basket.id);

  const [view, tier, allProducts, streak, cumulativeSavings, lastOrder] = await Promise.all([
    getStandingBasketView(user.id),
    prisma.subscriptionTier.findUniqueOrThrow({ where: { id: user.subscriptionTierId } }),
    prisma.product.findMany(),
    recomputeStreak(user.id),
    computeCumulativeSavings(user.id),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  const state = windowState(window);
  const basketItems = view?.basket.items ?? [];
  const basketProductIds = basketItems.map((i) => i.productId);

  const flagged = getFlaggedSwaps(
    basketItems.map((i) => ({ productId: i.productId, product: i.product })),
    allProducts,
  );

  const quickAdd = await getQuickAddItems(
    user.id,
    user.preferences?.favoriteProductIds ?? [],
    basketProductIds,
  );

  const goalFit = computeGoalFit(
    basketItems.map((i) => i.product.category),
    user.preferences?.primaryGoal,
  );

  const signature = basketItems
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join(",");

  const lines = basketItems.map((i) => ({
    productId: i.productId,
    name: i.product.name,
    unit: i.product.unit,
    inSeason: i.product.inSeason,
    stepQty: i.product.stepQty,
    imageEmoji: i.product.imageEmoji,
    cloudinaryPublicId: i.product.cloudinaryPublicId,
    memberPrice: i.product.memberPrice,
    standardPrice: i.product.standardPrice,
    quantity: i.quantity,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Your standing basket</h1>
      <p className="mt-1 text-sm text-muted">
        We pre-fill this each week. Edit it however you like. You are only charged for what is in it when
        the window closes.
      </p>

      {/* Window countdown (existing edit-before-charge logic) */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-sm">
        {state.skipped ? (
          <span className="font-medium text-ripe-terracotta-dark">You have skipped this week.</span>
        ) : state.locked ? (
          <span className="font-medium text-ripe-terracotta-dark">This week&rsquo;s window is closed.</span>
        ) : (
          <span className="font-medium text-ripe-green">Window closes in {state.hoursLeft} hours</span>
        )}
        <span className="text-muted">
          Closes{" "}
          {window.closesAt.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" })}
        </span>
        {basket.frequencyWeeks === 2 && (
          <span className="text-muted">Delivering every 2 weeks</span>
        )}
      </div>

      {/* Perks strip */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-ripe-green px-3 py-1 text-xs font-medium text-white">
          {tier.name} member
        </span>
        {tier.perks.map((perk) => (
          <span
            key={perk}
            className="rounded-full border border-ripe-green/40 bg-ripe-green-light/50 px-3 py-1 text-xs text-ripe-green"
          >
            ✓ {perk}
          </span>
        ))}
      </div>

      {/* Streak + savings */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StreakCard view={streak} />
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Saved with membership so far</p>
          <p className="text-2xl font-semibold">{formatNaira(cumulativeSavings)}</p>
          <p className="text-xs text-muted">Across every order vs standard pricing</p>
        </div>
      </div>

      <div className="mt-8">
        <BasketWorkspace
          items={lines}
          locked={state.locked}
          skipped={state.skipped}
          deliveryDay={deliveryDay}
          streak={streak}
          memberSubtotal={view?.memberSubtotal ?? 0}
          savings={view?.savings ?? 0}
          goalFit={goalFit}
          quickAdd={quickAdd.map((p) => ({
            id: p.id,
            name: p.name,
            imageEmoji: p.imageEmoji,
            cloudinaryPublicId: p.cloudinaryPublicId,
            minOrderQty: p.minOrderQty,
          }))}
          flagged={flagged}
          canRestore={Boolean(lastOrder)}
          signature={signature}
        />
      </div>

      <p className="mt-8 rounded-xl border border-dashed border-border p-4 text-xs text-muted">
        Known gap (phase 2): windows are opened and charged on a schedule in production. For now the
        window is created when you visit this page and no real charge is taken.
      </p>
    </div>
  );
}
