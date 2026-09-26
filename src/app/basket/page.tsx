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
import { shoppingWindowConfig } from "@/lib/shopping-window";
import { StreakCard } from "@/components/streak-badge";
import { BasketWorkspace } from "./basket-workspace";
import { Icon } from "@/components/ui/icon";

export default async function BasketPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");

  const isSubscriber = Boolean(user.subscriptionTierId);
  const deliveryDay = user.deliveryDay ?? "WEDNESDAY";
  const basket = await getOrCreateStandingBasket(user.id, deliveryDay);
  await prefillStandingBasket(user.id, basket.id);

  const [view, allProducts, streak, cumulativeSavings, lastOrder] = await Promise.all([
    getStandingBasketView(user.id),
    prisma.product.findMany(),
    recomputeStreak(user.id),
    computeCumulativeSavings(user.id),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  // The window lock / skip mechanic is subscriber-only.
  const windowRow = isSubscriber ? await getOrCreateCurrentWindow(user.id) : null;
  const state = windowRow ? windowState(windowRow) : { locked: false, skipped: false, hoursLeft: 0, msLeft: 0 };
  const tier = user.subscriptionTierId
    ? await prisma.subscriptionTier.findUnique({ where: { id: user.subscriptionTierId } })
    : null;

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

  const windowCfg = user.shoppingWindowDay ? shoppingWindowConfig(user.shoppingWindowDay) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-heading-lg">Your basket</h1>
      <p className="mt-1 text-sm text-muted">
        We keep this saved for you and pre-fill it to start. Edit it however you like. Nothing is
        charged automatically. Checking out is the only thing that places the order.
      </p>

      {windowCfg && (
        <div className="mt-4 rounded-card border border-border bg-surface p-4 text-sm">
          <span className="font-medium">Scheduled to ship {windowCfg.label}.</span>{" "}
          <span className="text-muted">{windowCfg.cutoffCopy}. Cutoff times are placeholders for now.</span>
        </div>
      )}

      {/* Subscriber-only window countdown */}
      {isSubscriber && windowRow && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface p-4 text-sm">
          {state.skipped ? (
            <span className="font-medium text-carbon">You have skipped this week.</span>
          ) : state.locked ? (
            <span className="font-medium text-carbon">This week&rsquo;s edit window is closed.</span>
          ) : (
            <span className="font-medium text-carbon">Edit window closes in {state.hoursLeft} hours</span>
          )}
          {basket.frequencyWeeks === 2 && <span className="text-muted">Delivering every 2 weeks</span>}
        </div>
      )}

      {/* Subscriber perks + streak + savings */}
      {isSubscriber && tier && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-carbon px-3 py-1 text-xs font-medium text-white">
              {tier.name} member
            </span>
            {tier.perks.map((perk) => (
              <span
                key={perk}
                className="inline-flex items-center gap-1.5 rounded-full border border-carbon/40 bg-sky-wash px-3 py-1 text-xs text-carbon"
              >
                <Icon name="check" size={14} />
                {perk}
              </span>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StreakCard view={streak} />
            <div className="rounded-card border border-border bg-surface p-4">
              <p className="text-xs text-muted">Saved with membership so far</p>
              <p className="text-2xl font-semibold">{formatNaira(cumulativeSavings)}</p>
              <p className="text-xs text-muted">Across every order vs standard pricing</p>
            </div>
          </div>
        </>
      )}

      {!isSubscriber && (
        <div className="mt-4 rounded-card border border-dashed border-border p-4 text-sm">
          <span className="text-muted">
            Ordering often? A subscription unlocks member pricing, free delivery on your day, and combo
            pricing.
          </span>{" "}
          <a href="/subscribe" className="font-medium text-carbon underline">
            See what it unlocks
          </a>
        </div>
      )}

      <div className="mt-8">
        <BasketWorkspace
          items={lines}
          isSubscriber={isSubscriber}
          shoppingWindowDay={user.shoppingWindowDay}
          locked={state.locked}
          skipped={state.skipped}
          streak={streak}
          memberSubtotal={view?.memberSubtotal ?? 0}
          standardSubtotal={view?.standardSubtotal ?? 0}
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
    </div>
  );
}
