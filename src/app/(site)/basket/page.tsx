import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateActiveDelivery, isMember, priceFor } from "@/lib/order-container";
import { basketLimitFor } from "@/lib/basket";
import { dayIn, getDeliveryCycle, liveOrdersFor, zoneForUser } from "@/lib/delivery";
import { cutoffFor, lagosDate, nextDeliveryDate } from "@/lib/delivery-dates";
import { deliveryName, orderRef, shortDate } from "@/lib/delivery-labels";
import { customerStatusLabel } from "@/lib/order-status";
import { creditBalance } from "@/lib/credit";
import { getMenu } from "@/lib/menu";
import { MENU_GOALS } from "@/lib/menu-types";
import { BUYABLE, toAddable, toCardData } from "@/lib/product";
import { DeliverySwitcher } from "./delivery-switcher";
import { DeliveryCard, type AreaState } from "./delivery-card";
import { LiveOrders, type LiveOrder } from "./live-orders";
import { OrderLines } from "./order-lines";
import { SuggestionRail } from "./suggestion-rail";
import { CookThisWeek, type CookRecipe } from "./cook-this-week";
import { OrderSummary } from "./order-summary";

const DAY = 86_400_000;

/*
 * Home: the order the customer is filling, and everything about it. Which
 * delivery (when there's more than one), when it comes and until when it can
 * change, orders already on their way, what's in it, and what to add. The
 * lines and the total come from the cart provider, so they move with every
 * tap; the rest is worked out here and refreshes quietly after changes.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/basket");

  const member = isMember(user);
  const [delivery, zone] = await Promise.all([getOrCreateActiveDelivery(user), zoneForUser(user.id)]);

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

  const live = toLiveOrders(liveRows, zone?.cutoffHour ?? 18);

  /* --------------------------- what to add next --------------------------- */

  const inOrder = new Set(items.map((i) => i.productId));
  const inOrderSlugs = new Set(items.map((i) => i.product.slug));

  const usualRank = [...new Set([...(user.preferences?.favoriteProductIds ?? []), ...ordered.map((o) => o.productId)])].filter((id) => !inOrder.has(id));
  const rank = new Map(usualRank.map((id, i) => [id, i]));

  const [usualRows, seasonRows, swapPool, menuProducts] = await Promise.all([
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
    prisma.product.findMany({ where: { slug: { in: [...new Set(menu.flatMap((r) => r.basket))] }, ...BUYABLE }, select: { slug: true, memberPrice: true, standardPrice: true, minOrderQty: true } }),
  ]);
  const usuals = usualRows.sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)).slice(0, 10);

  const swaps: Record<string, ReturnType<typeof toAddable>> = {};
  for (const i of items) {
    if (i.product.availability !== "OUT_OF_STOCK") continue;
    const s = swapPool.find((p) => p.category === i.product.category && !Object.values(swaps).some((x) => x.id === p.id));
    if (s) swaps[i.productId] = toAddable(s);
  }

  const buyable = new Map(menuProducts.map((p) => [p.slug, p]));
  const goal = MENU_GOALS.find((g) => g.starterSlug === user.preferences?.primaryGoal) ?? null;
  const scored = menu
    .filter((r) => r.image)
    .map((r) => {
      const have = r.basket.filter((s) => inOrderSlugs.has(s)).length;
      const missing = r.basket.filter((s) => !inOrderSlugs.has(s) && buyable.has(s));
      const needCost = missing.reduce((sum, s) => {
        const p = buyable.get(s)!;
        return sum + priceFor(p, member) * p.minOrderQty;
      }, 0);
      return { r, have, need: missing.length, needCost };
    });
  const withOverlap = scored.filter((x) => x.have > 0).sort((a, b) => b.have - a.have || a.need - b.need);
  const cookPicks = (withOverlap.length ? withOverlap : scored.filter((x) => !goal || x.r.goal === goal.id)).slice(0, 4);
  const cook: CookRecipe[] = cookPicks.map(({ r, have, need, needCost }) => ({ slug: r.slug, title: r.title, image: r.image, minutes: r.minutes, have, total: r.basket.length, need, needCost }));

  /* -------------------------------- framing -------------------------------- */

  const today = lagosDate(new Date()).getTime();
  const daysAway = cycle.date ? Math.round((cycle.date.getTime() - today) / DAY) : null;
  // This delivery already has an order coming before its next date: the order being filled is next week's.
  const earlierOrder = liveRows.some((o) => o.basketId === delivery.id && cycle.date && o.deliveryDate < cycle.date && o.status !== "DELIVERED");
  const title = daysAway === null ? "Your order" : daysAway <= 7 && !earlierOrder ? "This week's order" : daysAway <= 14 ? "Next week's order" : `Order for ${shortDate(cycle.date!)}`;

  const list = deliveries.map((d) => ({ id: d.id, label: deliveryName(d, dayIn(zone, d.deliveryDay)), itemCount: d._count.items }));
  const limit = basketLimitFor(member, user.subscriptionTier?.slug);
  const canAddMore = limit === null || deliveries.length < limit;
  const monthSaved = monthOrders.reduce((s, o) => s + o.items.reduce((t, i) => t + Math.max(0, i.product.standardPrice - i.unitPrice) * i.quantity, 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:pb-12">
      {list.length > 1 && <DeliverySwitcher deliveries={list} activeId={delivery.id} canAddMore={canAddMore} member={member} dayOptions={dayOptions} />}

      <DeliveryCard
        title={title}
        eyebrow={list.length > 1 ? list.find((d) => d.id === delivery.id)?.label ?? null : null}
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

          {cook.length > 0 && <CookThisWeek deliveryId={delivery.id} recipes={cook} fromOrder={withOverlap.length > 0} />}
          {usuals.length > 0 && <SuggestionRail title="Your usuals" subtitle="What you buy most, and your favourites." products={usuals.map(toCardData)} />}
          {seasonRows.length > 0 && <SuggestionRail title="Good this week" subtitle="In stock and at its best right now." products={seasonRows.map(toCardData)} />}
        </div>

        <OrderSummary
          deliveryId={delivery.id}
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
function toLiveOrders(rows: Awaited<ReturnType<typeof liveOrdersFor>>, fallbackCutoffHour: number): LiveOrder[] {
  const now = Date.now();
  return rows.map((o) => {
    const cutoff = cutoffFor(o.deliveryDate, o.deliveryZone?.cutoffHour ?? fallbackCutoffHour);
    return {
      id: o.id,
      ref: orderRef(o.id),
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
