import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateActiveDelivery, isMember } from "@/lib/order-container";
import { basketLimitFor } from "@/lib/basket";
import { getDeliveryCycle, liveOrdersFor, zoneForUser } from "@/lib/delivery";
import { cutoffFor, lagosDate, nextDeliveryDate } from "@/lib/delivery-dates";
import { basketLabels, dayName, deliveryName, orderRef } from "@/lib/delivery-labels";
import { basketCycle, confirmRight } from "@/lib/basket-rules";
import { customerStatusLabel } from "@/lib/order-status";
import { awaitingPayment } from "@/lib/order-copy";
import { creditBalance } from "@/lib/credit";
import { getMenu } from "@/lib/menu";
import { buyableFor, fitRecipe } from "@/lib/recipe-fit";
import { homeFor } from "@/lib/home-for-goal";
import { MENU_GOALS } from "@/lib/menu-types";
import { BUYABLE, toAddable, toCardData } from "@/lib/product";
import { DeliverySwitcher } from "./delivery-switcher";
import { DeliveryCard, type AreaState, type BasketStatus } from "./delivery-card";
import { LiveOrders, type LiveOrder } from "./live-orders";
import { OrderLines } from "./order-lines";
import { SuggestionsCard, type Suggestion } from "./suggestions-card";
import { CookThisWeek, type CookRecipe } from "./cook-this-week";
import { KachiDraftCard, type HomeDraft } from "./kachi-draft-card";
import { draftChanges, homeDraft } from "@/lib/kachi-draft";
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
    prisma.basket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, deliveryDay: true, oneOff: true, _count: { select: { items: true } } } }),
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

  /* -------------------------------- names -------------------------------- */

  const labels = basketLabels(deliveries);
  const labelOf = (d: { id: string; name: string | null; oneOff?: boolean }) => labels.get(d.id) ?? deliveryName(d);

  /* ------------------------------ live orders ------------------------------ */

  const names = new Map(deliveries.map((d) => [d.id, labelOf(d)]));
  const live = toLiveOrders(liveRows, zone?.cutoffHour ?? 18, (basketId) => (basketId && basketId !== delivery.id ? (names.get(basketId) ?? null) : null));

  /* ------------------------- Kachi's weekly suggestion ------------------------- */

  // Only while this delivery can still change and isn't confirmed yet.
  const confirmed = liveRows.some((o) => o.basketId === delivery.id && cycle.date && o.deliveryDate.getTime() === cycle.date.getTime());
  const draftRow = cycle.date && cycle.cutoff && !confirmed ? await homeDraft(user.id, delivery.id, cycle.date, cycle.cutoff) : null;
  let draft: HomeDraft | null = null;
  if (draftRow) {
    const changes = draftChanges(draftRow.changes);
    const [products, recipe] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: changes.map((c) => c.productId) } }, select: { id: true, name: true, imageEmoji: true, cloudinaryPublicId: true, memberPrice: true, standardPrice: true } }),
      draftRow.recipeSlug ? prisma.recipe.findUnique({ where: { slug: draftRow.recipeSlug }, select: { slug: true, title: true } }) : Promise.resolve(null),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const lines = changes.flatMap((c) => {
      const p = byId.get(c.productId);
      return p ? [{ productId: p.id, name: p.name, emoji: p.imageEmoji, publicId: p.cloudinaryPublicId, before: c.before, after: c.after, why: c.why }] : [];
    });
    const price = (id: string) => {
      const p = byId.get(id)!;
      return member ? p.memberPrice : p.standardPrice;
    };
    draft = {
      id: draftRow.id,
      status: draftRow.status === "ACCEPTED" ? "ACCEPTED" : "PENDING",
      note: draftRow.note,
      day: dayName(cycle.day),
      lines,
      difference: lines.reduce((t, l) => t + (l.after - l.before) * price(l.productId), 0),
      recipe,
    };
  }

  /* --------------------------- what to add next --------------------------- */

  const inOrder = new Set(items.map((i) => i.productId));
  const inOrderSlugs = new Set(items.map((i) => i.product.slug));

  const usualRank = [...new Set([...(user.preferences?.favoriteProductIds ?? []), ...ordered.map((o) => o.productId)])].filter((id) => !inOrder.has(id));
  const rank = new Map(usualRank.map((id, i) => [id, i]));

  // Home is arranged around what they're after: this basket's goal, else theirs.
  const goal =
    MENU_GOALS.find((g) => g.id === delivery.goalTag || g.starterSlug === delivery.goalTag) ?? MENU_GOALS.find((g) => g.starterSlug === user.preferences?.primaryGoal) ?? null;
  const layout = homeFor(goal?.id ?? null);

  const [usualRows, seasonRows, swapPool, buyable, savedRows] = await Promise.all([
    usualRank.length ? prisma.product.findMany({ where: { id: { in: usualRank }, ...BUYABLE } }) : Promise.resolve([]),
    prisma.product.findMany({
      where: { ...BUYABLE, availability: "AVAILABLE", id: { notIn: [...inOrder, ...usualRank] }, ...(layout.season.category ? { category: layout.season.category } : {}) },
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

  // A short list with a reason on every line: their usuals first, then what's in season.
  const favourite = new Set(user.preferences?.favoriteProductIds ?? []);
  const topUsuals = usuals.slice(0, 3);
  const suggestions: Suggestion[] = [
    ...topUsuals.map((p) => ({ product: toCardData(p), reason: favourite.has(p.id) ? "One of your favourites" : "You order this most" })),
    ...seasonRows
      .filter((p) => !topUsuals.some((u) => u.id === p.id))
      .slice(0, topUsuals.length ? 2 : 4)
      .map((p) => ({ product: toCardData(p), reason: p.inSeason ? "In season now" : layout.season.subtitle })),
  ];
  const suggestAt = layout.order.find((s) => s !== "cook");

  const swaps: Record<string, ReturnType<typeof toAddable>> = {};
  for (const i of items) {
    if (i.product.availability !== "OUT_OF_STOCK") continue;
    const s = swapPool.find((p) => p.category === i.product.category && !Object.values(swaps).some((x) => x.id === p.id));
    if (s) swaps[i.productId] = toAddable(s);
  }

  // Recipes for their goal first; for busy weeks, only quick ones when there are enough.
  const pool = menu.filter((r) => r.image);
  const quick = layout.maxMinutes ? pool.filter((r) => r.minutes > 0 && r.minutes <= layout.maxMinutes!) : [];
  const scored = (quick.length >= 2 ? quick : pool).map((r) => ({ goal: r.goal, fit: fitRecipe(r, inOrderSlugs, buyable, member) }));
  const forGoal = (x: { goal: string }) => (goal && x.goal === goal.id ? 1 : 0);
  const withOverlap = scored.filter((x) => x.fit.have > 0).sort((a, b) => forGoal(b) - forGoal(a) || b.fit.have - a.fit.have || a.fit.need - b.fit.need);
  const goalFirst = [...scored].sort((a, b) => forGoal(b) - forGoal(a));
  const cook: CookRecipe[] = (withOverlap.length ? withOverlap : goalFirst).slice(0, 4).map((x) => x.fit);
  const savedIds = savedRows.map((s) => s.recipeId);

  /* ------------------------------ the basket ------------------------------ */

  // Members' baskets run in 4-week cycles from when they joined.
  const weeks = member && delivery.isStanding && !delivery.oneOff && zone ? await basketCycle(delivery, cycle.day, zone, user.subscribedAt) : null;
  const status: BasketStatus = delivery.oneOff && right.ok ? "oneoff" : !right.ok ? "trial-used" : right.trial ? "trial" : delivery.isStanding ? "running" : "paused";

  // An empty one-time order stays out of the way unless it's the one open.
  const list = deliveries
    .filter((d) => !d.oneOff || d._count.items > 0 || d.id === delivery.id)
    .map((d) => ({ id: d.id, label: labelOf(d), itemCount: d._count.items, oneOff: d.oneOff }));
  const limit = basketLimitFor(member, user.subscriptionTier?.slug);
  const canAddMore = limit === null || deliveries.filter((d) => !d.oneOff).length < limit;
  const monthSaved = monthOrders.reduce((s, o) => s + o.items.reduce((t, i) => t + Math.max(0, i.product.standardPrice - i.unitPrice) * i.quantity, 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:pb-12">
      {list.length > 1 && <DeliverySwitcher deliveries={list} activeId={delivery.id} />}

      <DeliveryCard
        title={labelOf(delivery)}
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

      {draft && <KachiDraftCard key={`${draft.id}:${draft.status}`} draft={draft} />}

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <OrderLines
            deliveryId={delivery.id}
            swaps={swaps}
            lastOrder={lastOrder ? { id: lastOrder.id, itemCount: lastOrder._count.items, dateIso: lastOrder.deliveryDate.toISOString() } : null}
            goalLabel={goal?.label ?? null}
          />

          {/* In the order their goal puts first: the recipes, and the one list of what to add. */}
          {layout.order.map((section) =>
            section === "cook" ? (
              cook.length > 0 && (
                <CookThisWeek
                  key="cook"
                  deliveryId={delivery.id}
                  recipes={cook}
                  fromOrder={withOverlap.length > 0}
                  savedIds={savedIds}
                  hasSaved={savedIds.length > 0}
                  title={layout.cook.title}
                  subtitle={withOverlap.length > 0 && !goal ? undefined : layout.cook.subtitle}
                />
              )
            ) : section === suggestAt ? (
              suggestions.length > 0 && <SuggestionsCard key="suggest" title="Kachi suggests" suggestions={suggestions} />
            ) : null,
          )}
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
      statusLabel: customerStatusLabel(o.status, awaitingPayment(o)),
      deliveryDateIso: o.deliveryDate.toISOString(),
      isToday: o.deliveryDate.toISOString().slice(0, 10) === new Date(now + 3_600_000).toISOString().slice(0, 10),
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
