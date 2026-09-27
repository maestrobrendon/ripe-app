import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { resolveActiveBasket, getBasketView, getUserBaskets, prefillStandingBasket } from "@/lib/basket";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import { computeGoalFit, getQuickAddItems, getFlaggedSwaps } from "@/lib/basket-hub";
import { recomputeStreak } from "@/lib/streak";
import { markBasketIntroSeen } from "./actions";
import { SubscriberGate } from "@/components/ui/subscriber-gate";
import { HomeCartTabs } from "@/components/home-cart-tabs";
import { MemberStatusCard } from "./member-status-card";
import { BasketSwitcher } from "./basket-switcher";
import { BasketWorkspace } from "./basket-workspace";
import { BottomBar } from "./bottom-bar";

export default async function BasketPage({
  searchParams,
}: {
  searchParams: Promise<{ pickDay?: string; b?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");

  const { pickDay, b: requestedBasketId } = await searchParams;

  const isSubscriber = Boolean(user.subscriptionTierId);
  const deliveryDay = user.deliveryDay ?? "WEDNESDAY";
  const basket = await resolveActiveBasket(user.id, requestedBasketId, { isSubscriber, deliveryDay });
  await prefillStandingBasket(user.id, basket.id);

  const [view, allProducts, streak, lastOrder, allBaskets] = await Promise.all([
    getBasketView(basket.id),
    prisma.product.findMany(),
    recomputeStreak(user.id),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    // Only a subscriber can have more than one, so this is skipped otherwise.
    isSubscriber ? getUserBaskets(user.id) : Promise.resolve([]),
  ]);

  // The window lock is a subscriber-basket mechanic; a free-trial basket never
  // auto-recurs, so it never opens a window to lock or skip.
  const windowRow = !basket.isFreeTrial ? await getOrCreateCurrentWindow(basket.id) : null;
  const state = windowRow ? windowState(windowRow) : { locked: false, skipped: false, hoursLeft: 0, msLeft: 0 };

  const basketItems = view?.basket.items ?? [];
  const basketProductIds = basketItems.map((i) => i.productId);
  const isMemberPriced = basket.pricingMode === "MEMBER";

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

  const runningValue = view?.effectiveSubtotal ?? 0;
  const showIntro = !user.basketIntroSeen;
  if (showIntro) await markBasketIntroSeen();

  return (
    <div className="min-h-[calc(100svh-1px)] bg-soft-mist">
      {/* Bottom padding clears the fixed checkout bar so it never overlaps the last item. */}
      <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6 sm:py-10">
        <HomeCartTabs homeHref={`/basket?b=${basket.id}`} />

        {showIntro && (
          <p className="mb-4 text-sm text-muted">
            Your basket is saved and pre-filled to start. Edit it however you like. Nothing is charged
            automatically. Checking out is the only thing that places the order.
          </p>
        )}

        {isSubscriber && allBaskets.length > 1 && (
          <BasketSwitcher
            baskets={allBaskets.map((bk, i) => ({ id: bk.id, label: `Basket ${i + 1}` }))}
            activeId={basket.id}
          />
        )}
        {!isSubscriber && (
          <SubscriberGate
            className="mb-4"
            title="Multiple baskets"
            body="Your free basket is standard pricing, one only. Subscribe to hold several baskets at member pricing."
          />
        )}

        <MemberStatusCard
          basketId={basket.id}
          firstName={user.name.trim().split(/\s+/)[0] || "There"}
          shipDay={basket.shoppingWindowDay}
          runningValue={runningValue}
          isMemberPriced={isMemberPriced}
          isFreeTrial={basket.isFreeTrial}
          savings={view?.savings ?? 0}
          potentialSavings={view?.savings ?? 0}
          streak={streak}
          signature={signature}
          locked={state.locked || state.skipped}
          autoOpenDayPicker={pickDay === "1"}
        />

        {windowRow && (state.skipped || state.locked) && (
          <p className="mt-3 text-center text-sm text-muted">
            {state.skipped ? "You have skipped this week." : "This week's edit window is closed."}
          </p>
        )}

        <div className="mt-6">
          <BasketWorkspace
            basketId={basket.id}
            items={lines}
            isMemberPriced={isMemberPriced}
            isFreeTrial={basket.isFreeTrial}
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

      <BottomBar
        basketId={basket.id}
        runningValue={runningValue}
        shipDay={basket.shoppingWindowDay}
        hasItems={lines.length > 0}
        skipped={state.skipped}
        locked={state.locked}
      />
    </div>
  );
}
