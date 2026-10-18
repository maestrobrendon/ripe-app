import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateActiveDelivery, isMember } from "@/lib/order-container";
import { basketLimitFor } from "@/lib/basket";
import { getDeliveryCycle, liveOrdersFor, zoneForUser } from "@/lib/delivery";
import { cutoffFor, lagosDate, nextDeliveryDate } from "@/lib/delivery-dates";
import { basketName, deliveryName, orderRef } from "@/lib/delivery-labels";
import { basketCycle, confirmRight } from "@/lib/basket-rules";
import { customerStatusLabel } from "@/lib/order-status";
import { creditBalance } from "@/lib/credit";
import { getMenu } from "@/lib/menu";
import { buyableFor, fitRecipe } from "@/lib/recipe-fit";
import { MENU_GOALS } from "@/lib/menu-types";
import { BUYABLE, toAddable, toCardData } from "@/lib/product";
import { DeliverySwitcher } from "./delivery-switcher";
import { DeliveryCard, type AreaState, type BasketStatus } from "./delivery-card";
import { LiveOrders, type LiveOrder } from "./live-orders";
import { OrderLines } from "./order-lines";
import { SuggestionRail } from "./suggestion-rail";
import { CookThisWeek, type CookRecipe } from "./cook-this-week";
import { OrderSummary } from "./order-summary";


/*
 * Home: the customer's basket, and everything about it. Which basket (they
 * can run several, like "Mine" and "For Mum"), whether it comes every week,
 * its next delivery and until when it can change, its 4-week cycle, what's
 * on its way, what's in it and what to add. The lines and the total come
 * from the cart provider, so they move with every tap; the rest is worked
 * out here and refreshes quietly after changes. See lib/basket-rules.ts.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");

  const member = isMember(user);
  const [delivery, zone, right] = await Promise.all([getOrCreateActiveDelivery(user), zoneForUser(user.id), confirmRight(user)]);

  const [deliveries, cycle, liveRows, items, lastOrder, credit, menu, monthOrders, ordered] = await Promise.all([
    prisma.basket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, deliveryDay: true, _count: { select: { items: true } } } }),
    getDeliveryCycle(delivery, zone),
    liveOrdersFor(user.id),
    prisma.basketItem.findMany({ where: { basketId: delivery.id }, select: { productId: true, product: { select: { slug: true, category: true, availability: true } } } }),
    prisma.order.findFirst({
      where: { userId: user.id, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, deliveryDate: true, _count: { select: { items: true } } },
    }),
    creditBalance(user.id),
    getMenu(),
    member
      ? prisma.order.findMany({
          where: { userId: user.id, status: { notIn: ["CANCELLED", "REFUNDED"] }, createdAt: { gte: monthStart() } },
          select: { items: { select: { quantity: true, unitPrice: true, product: { select: { standardPrice: true } } } } },
        })
      : Promise.resolve([]),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { userId: user.id, status: { notIn: ["CANCELLED", "REFUNDED"] } } },
      _count: { productId: true },
      orderBy: { _count: { productId: "desc" } },
      take: 24,
    }),
  ]);

  /* --------------------------------- area -------------------------------- */

  let area: AreaState = { state: "ok" };
  if (!zone) {
    const known = (await prisma.address.findFirst({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { zone: { select: { name: true } } } }))?.zone ?? user.deliveryZone;
    area = known ? { state: "unserved", name: known.name } : { state: "none" };
  }

  const dayOptions = (zone?.deliveryDays ?? []).map((day) => {
    const date = nextDeliveryDate(day, zone!.cutoffHour);
    return { day, dateIso: date.toISOString(), cutoffIso: cutoffFor(date, zone!.cutoffHour).toISOString() };
  });

  /* ------------------------------ live orders ------------------------------ */

  const names = new Map(deliveries.map((d) => [d.id, deliveryName(d)]));
  const live = toLiveOrders(liveRows, zone?.cutoffHour ?? 18, (basketId) => (basketId && basketId !== delivery.id ? (names.get(basketId) ?? null) : null));

  /* --------------------------- what to add next --------------------------- */

  const inOrder = new Set(items.map((i) => i.productId));
  const inOrderSlugs = new Set(items.map((i) => i.product.slug));

  const usualRank = [...new Set([...(user.preferences?.favoriteProductIds ?? []), ...ordered.map((o) => o.productId)])].filter((id) => !inOrder.has(id));
  const rank = new Map(usualRank.map((id, i) => [id, i]));

  const [usualRows, seasonRows, swapPool, buyable, savedRows] = await Promise.all([
    usualRank.length ? prisma.product.findMany({ where: { id: { in: usualRank }, ...BUYABLE } }) : Promise.resolve([]),
    prisma.product.findMany({
      where: { ...BUYABLE, availability: "AVAILABLE", id: { notIn: [...inOrder, ...usualRank] } },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: 10,
    }),
    // Swaps for anything in the order that's sold out: same kind, in stock.
    items.some((i) => i.product.availability === "OUT_OF_STOCK")
      ? prisma.product.findMany({ where: { ...BUYABLE, availability: "AVAILABLE", category: { in: items.map((i) => i.product.category) }, id: { notIn: [...inOrder] } }, orderBy: [{ featured: "desc" }, { name: "asc" }] })
      : Promise.resolve([]),
    buyableFor(menu),
    prisma.savedRecipe.findMany({ where: { userId: user.id }, select: { recipeId: true } }),
  ]);
  const usuals = usualRows.sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)).slice(0, 10);

  const swaps: Record<string, ReturnType<typeof toAddable>> = {};
  for (const i of items) {
    if (i.product.availability !== "OUT_OF_STOCK") continue;
    const s = swapPool.find((p) => p.category === i.product.category && !Object.values(swaps).some((x) => x.id === p.id));
    if (s) swaps[i.productId] = toAddable(s);
  }

  const goal = MENU_GOALS.find((g) => g.starterSlug === user.preferences?.primaryGoal) ?? null;
  const scored = menu.filter((r) => r.image).map((r) => ({ goal: r.goal, fit: fitRecipe(r, inOrderSlugs, buyable, member) }));
  const withOverlap = scored.filter((x) => x.fit.have > 0).sort((a, b) => b.fit.have - a.fit.have || a.fit.need - b.fit.need);
  const cook: CookRecipe[] = (withOverlap.length ? withOverlap : scored.filter((x) => !goal || x.goal === goal.id)).slice(0, 4).map((x) => x.fit);
  const savedIds = savedRows.map((s) => s.recipeId);

  /* ------------------------------ the basket ------------------------------ */

  // Members' baskets run in 4-week cycles from when they joined.
  const weeks = member && delivery.isStanding && zone ? await basketCycle(delivery, cycle.day, zone, user.subscribedAt) : null;
  const status: BasketStatus = !right.ok ? "trial-used" : right.trial ? "trial" : delivery.isStanding ? "running" : "paused";

  const list = deliveries.map((d) => ({ id: d.id, label: deliveryName(d), itemCount: d._count.items }));
  const limit = basketLimitFor(member, user.subscriptionTier?.slug);
  const canAddMore = limit === null || deliveries.length < limit;
  const monthSaved = monthOrders.reduce((s, o) => s + o.items.reduce((t, i) => t + Math.max(0, i.product.standardPrice - i.unitPrice) * i.quantity, 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:pb-12">
      {(list.length > 1 || (member && canAddMore)) && <DeliverySwitcher deliveries={list} activeId={delivery.id} canAddMore={canAddMore} member={member} dayOptions={dayOptions} />}

      <DeliveryCard
        title={basketName(delivery)}
        status={status}
        cycle={weeks ? { weekNumber: weeks.weekNumber, weeks: weeks.weeks } : null}
        deliveryId={delivery.id}
        name={delivery.name}
        day={cycle.day}
        dateIso={cycle.date?.toISOString() ?? null}
        cutoffIso={cycle.cutoff?.toISOString() ?? null}
        skippedDateIso={cycle.skippedDate?.toISOString() ?? null}
        areaName={zone?.name ?? null}
        area={area}
        isStanding={delivery.isStanding}
        dayOptions={dayOptions}
        canRemove={list.length > 1}
        canAddMore={canAddMore}
        member={member}
        hasLiveOrder={liveRows.some((o) => o.basketId === delivery.id && o.status !== "DELIVERED")}
      />

      {live.length > 0 && <LiveOrders deliveryId={delivery.id} orders={live} />}

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <OrderLines
            deliveryId={delivery.id}
            swaps={swaps}
            lastOrder={lastOrder ? { id: lastOrder.id, itemCount: lastOrder._count.items, dateIso: lastOrder.deliveryDate.toISOString() } : null}
            goalLabel={goal?.label ?? null}
          />

          {cook.length > 0 && <CookThisWeek deliveryId={delivery.id} recipes={cook} fromOrder={withOverlap.length > 0} savedIds={savedIds} hasSaved={savedIds.length > 0} />}
          {usuals.length > 0 && <SuggestionRail title="Your usuals" subtitle="What you buy most, and your favourites." products={usuals.map(toCardData)} />}
          {seasonRows.length > 0 && <SuggestionRail title="Good this week" subtitle="In stock and at its best right now." products={seasonRows.map(toCardData)} />}
        </div>

        <OrderSummary
          deliveryId={delivery.id}
          gated={status === "trial-used"}
          day={cycle.day}
          canConfirm={Boolean(cycle.date) && area.state === "ok"}
          dateIso={cycle.date?.toISOString() ?? null}
          cutoffIso={cycle.cutoff?.toISOString() ?? null}
          credit={credit}
          monthSaved={monthSaved}
        />
      </div>
    </div>
  );
}

/** Orders already placed from this delivery, as Home shows them. */
function toLiveOrders(rows: Awaited<ReturnType<typeof liveOrdersFor>>, fallbackCutoffHour: number, otherBasket: (basketId: string | null) => string | null): LiveOrder[] {
  const now = Date.now();
  return rows.map((o) => {
    const cutoff = cutoffFor(o.deliveryDate, o.deliveryZone?.cutoffHour ?? fallbackCutoffHour);
    return {
      id: o.id,
      ref: orderRef(o.id),
      basketLabel: otherBasket(o.basketId),
      status: o.status,
      statusLabel: customerStatusLabel(o.status),
      deliveryDateIso: o.deliveryDate.toISOString(),
      cutoffIso: cutoff.toISOString(),
      canCancel: o.status === "RECEIVED" && now < cutoff.getTime(),
      total: o.total,
      itemCount: o.items.length,
      paymentMethod: o.paymentMethod,
      paid: Boolean(o.paidAt),
      deliveredAtIso: o.deliveredAt?.toISOString() ?? null,
      rider: o.status === "OUT_FOR_DELIVERY" && o.deliveryRun?.rider ? { name: o.deliveryRun.rider.name, phone: o.deliveryRun.rider.phone } : null,
      preview: o.items.slice(0, 4).map((i) => ({ emoji: i.product.imageEmoji, publicId: i.product.cloudinaryPublicId, name: i.product.name })),
    };
  });
}

/** The first moment of this month in Lagos. */
function monthStart() {
  const l = lagosDate(new Date());
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - 3_600_000);
}
