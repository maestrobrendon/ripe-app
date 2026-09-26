import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateStandingBasket, getStandingBasketView, prefillStandingBasket } from "@/lib/basket";
import { getOrCreateCurrentWindow, windowState } from "@/lib/window";
import { computeGoalFit, getQuickAddItems, getFlaggedSwaps } from "@/lib/basket-hub";
import { recomputeStreak } from "@/lib/streak";
import { markBasketIntroSeen } from "./actions";
import { MemberStatusCard } from "./member-status-card";
import { BasketWorkspace } from "./basket-workspace";
import { BottomBar } from "./bottom-bar";

export default async function BasketPage({
  searchParams,
}: {
  searchParams: Promise<{ pickDay?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");

  const { pickDay } = await searchParams;

  const isSubscriber = Boolean(user.subscriptionTierId);
  const deliveryDay = user.deliveryDay ?? "WEDNESDAY";
  const basket = await getOrCreateStandingBasket(user.id, deliveryDay);
  await prefillStandingBasket(user.id, basket.id);

  const [view, allProducts, streak, lastOrder] = await Promise.all([
    getStandingBasketView(user.id),
    prisma.product.findMany(),
    recomputeStreak(user.id),
    prisma.order.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  // The window lock / skip mechanic is subscriber-only.
  const windowRow = isSubscriber ? await getOrCreateCurrentWindow(user.id) : null;
  const state = windowRow ? windowState(windowRow) : { locked: false, skipped: false, hoursLeft: 0, msLeft: 0 };

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

  const runningValue = isSubscriber ? view?.memberSubtotal ?? 0 : view?.standardSubtotal ?? 0;
  const showIntro = !user.basketIntroSeen;
  if (showIntro) await markBasketIntroSeen();

  return (
    <div className="min-h-[calc(100svh-1px)] bg-soft-mist">
      {/* Bottom padding clears the fixed checkout bar so it never overlaps the last item. */}
      <div className="mx-auto max-w-5xl px-4 py-8 pb-28 sm:px-6 sm:py-10">
        {showIntro && (
          <p className="mb-4 text-sm text-muted">
            Your basket is saved and pre-filled to start. Edit it however you like. Nothing is charged
            automatically. Checking out is the only thing that places the order.
          </p>
        )}

        <MemberStatusCard
          firstName={user.name.trim().split(/\s+/)[0] || "There"}
          shipDay={user.shoppingWindowDay}
          runningValue={runningValue}
          isSubscriber={isSubscriber}
          savings={view?.savings ?? 0}
          potentialSavings={view?.savings ?? 0}
          streak={streak}
          signature={signature}
          locked={state.locked || state.skipped}
          autoOpenDayPicker={pickDay === "1"}
        />

        {isSubscriber && windowRow && (state.skipped || state.locked) && (
          <p className="mt-3 text-center text-sm text-muted">
            {state.skipped ? "You have skipped this week." : "This week's edit window is closed."}
          </p>
        )}

        <div className="mt-6">
          <BasketWorkspace
            items={lines}
            isSubscriber={isSubscriber}
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
        runningValue={runningValue}
        shipDay={user.shoppingWindowDay}
        hasItems={lines.length > 0}
        skipped={state.skipped}
        locked={state.locked}
      />
    </div>
  );
}
