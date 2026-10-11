import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  resolveActiveBasket,
  getBasketView,
  getUserBaskets,
  getBasketItemCount,
  prefillStandingBasket,
} from "@/lib/basket";
import { readCart } from "@/lib/cart";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import { computeGoalFit, getQuickAddItems, getFlaggedSwaps } from "@/lib/basket-hub";
import { recomputeStreak } from "@/lib/streak";
import { SHOPPING_WINDOW_DAY_LABEL } from "@/lib/shopping-window";
import { markBasketIntroSeen } from "./actions";
import { BasketHero } from "./basket-hero";
import type { SheetBasket } from "./baskets-sheet";
import { BasketWorkspace } from "./basket-workspace";
import { TodayPicks } from "./today-picks";
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

  const [view, allProducts, streak, lastOrder, allBaskets, cart] = await Promise.all([
    getBasketView(basket.id),
    prisma.product.findMany(),
    recomputeStreak(user.id),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    // Only a subscriber can have more than one, so this is skipped otherwise.
    isSubscriber ? getUserBaskets(user.id) : Promise.resolve([basket]),
    readCart(),
  ]);

  // The window lock is a subscriber-basket mechanic; a free-trial basket never
  // auto-recurs, so it never opens a window to lock or skip.
  const windowRow = !basket.isFreeTrial ? await getOrCreateCurrentWindow(basket.id) : null;
  const state = windowRow ? windowState(windowRow) : { locked: false, skipped: false, hoursLeft: 0, msLeft: 0 };

  // Set once, at the moment this basket's one and only order was placed
  // (see checkout/actions.ts). Never set for a subscriber basket.
  const trialDelivered = Boolean(basket.trialDeliveredAt);

  const basketItems = view?.basket.items ?? [];
  const basketProductIds = basketItems.map((i) => i.productId);
  const cartProductIds = cart.items.map((i) => i.productId);
  const isMemberPriced = basket.pricingMode === "MEMBER";
  const basketName = basket.goalTag || "Your basket";

  const flagged = getFlaggedSwaps(
    basketItems.map((i) => ({ productId: i.productId, product: i.product })),
    allProducts,
  );

  const [quickAdd, todayPicks] = await Promise.all([
    getQuickAddItems(user.id, user.preferences?.favoriteProductIds ?? [], basketProductIds),
    getQuickAddItems(
      user.id,
      user.preferences?.favoriteProductIds ?? [],
      [...basketProductIds, ...cartProductIds],
      6,
    ),
  ]);

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

  const sheetBaskets: SheetBasket[] = await Promise.all(
    allBaskets.map(async (bk) => {
      const itemCount = bk.id === basket.id ? basketItems.length : await getBasketItemCount(bk.id);
      const name = bk.goalTag || "Your basket";
      const bkTrialDelivered = Boolean(bk.trialDeliveredAt);
      const subtitle = bkTrialDelivered
        ? "Trial delivered"
        : bk.isFreeTrial
        ? "Free trial, comes once"
        : bk.shoppingWindowDay
        ? `Every ${SHOPPING_WINDOW_DAY_LABEL[bk.shoppingWindowDay]}, ${itemCount} item${itemCount === 1 ? "" : "s"}`
        : `${itemCount} item${itemCount === 1 ? "" : "s"}`;
      return { id: bk.id, name, subtitle, locked: bkTrialDelivered };
    }),
  );

  return (
    <div className="min-h-[calc(100svh-1px)] bg-background">
      {/* The layout's <main> already reserves --dock-clearance for every
          signed-in page (zeroed on desktop, where the dock is a left rail —
          see layout.tsx). This only adds the extra room for the fixed
          checkout bar itself, which stacks above that clearance on mobile
          and sits flush on desktop — see bottom-bar.tsx. */}
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6 sm:pt-6 lg:pb-24">
        {showIntro && (
          <p className="mb-4 text-sm text-muted">
            Your basket is saved and pre-filled to start. Edit it however you like. Nothing is charged
            automatically. Checking out is the only thing that places the order.
          </p>
        )}

        <BasketHero
          basketId={basket.id}
          basketName={basketName}
          shipDay={basket.shoppingWindowDay}
          isMemberPriced={isMemberPriced}
          trialDelivered={trialDelivered}
          deliveredOn={basket.trialDeliveredAt}
          baskets={sheetBaskets}
          isSubscriber={isSubscriber}
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
            basketName={basketName}
            items={lines}
            isMemberPriced={isMemberPriced}
            isFreeTrial={basket.isFreeTrial}
            trialDelivered={trialDelivered}
            locked={state.locked}
            skipped={state.skipped}
            streak={streak}
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

        <div className="my-7 -mx-4 h-2 bg-soft-mist sm:mx-0 sm:rounded-full" />

        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-semibold">Buy something today</h2>
            <p className="text-xs text-muted">Goes in your cart. Delivered once.</p>
          </div>
          {cart.itemCount > 0 && (
            <a href="/cart" className="text-sm font-semibold text-carbon">
              See cart ({cart.itemCount})
            </a>
          )}
        </div>
        <div className="mt-2">
          <TodayPicks
            picks={todayPicks.map((p) => ({
              id: p.id,
              slug: p.slug,
              name: p.name,
              unit: p.unit,
              orderUnit: p.orderUnit,
              minOrderQty: p.minOrderQty,
              stepQty: p.stepQty,
              imageEmoji: p.imageEmoji,
              cloudinaryPublicId: p.cloudinaryPublicId,
              memberPrice: p.memberPrice,
              standardPrice: p.standardPrice,
            }))}
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
        hidden={trialDelivered}
      />
    </div>
  );
}
