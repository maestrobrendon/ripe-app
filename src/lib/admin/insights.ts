import "server-only";
import { prisma } from "@/lib/prisma";
import { orderToStock } from "@/lib/stock-core";

/*
 * Numbers for the Insights screens. Aggregates only: nothing here identifies
 * a customer, so every role with insights.view (Analyst included) can see
 * it. Days are Lagos days (UTC+1). Revenue counts paid orders that weren't
 * cancelled or refunded.
 */

const DAY = 86_400_000;
const LAGOS = 3_600_000;

export type DayPoint = { day: string; orders: number; revenue: number };

/** Orders and revenue per Lagos day for the last `days` days, zero-filled. */
export async function dailySales(days: number): Promise<DayPoint[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.$queryRaw<{ day: Date; orders: bigint; revenue: bigint | null }[]>`
    SELECT date_trunc('day', "createdAt" + interval '1 hour') AS day,
           count(*) AS orders,
           sum(CASE WHEN "paidAt" IS NOT NULL AND status NOT IN ('CANCELLED', 'REFUNDED') THEN total ELSE 0 END) AS revenue
    FROM "Order" WHERE "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1`;
  const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
  const out: DayPoint[] = [];
  const today = new Date(Date.now() + LAGOS);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - i * DAY).toISOString().slice(0, 10);
    const r = byDay.get(d);
    out.push({ day: d, orders: Number(r?.orders ?? 0), revenue: Number(r?.revenue ?? 0) });
  }
  return out;
}

export async function salesBreakdown(days: number) {
  const since = new Date(Date.now() - days * DAY);
  const counted = { createdAt: { gte: since }, paidAt: { not: null }, status: { notIn: ["CANCELLED" as const, "REFUNDED" as const] } };
  const [byZone, byType, totals, refunds, delivered, failed, cancelled] = await Promise.all([
    prisma.order.groupBy({ by: ["zoneName"], where: counted, _count: { _all: true }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } } }),
    prisma.order.groupBy({ by: ["orderType"], where: counted, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.aggregate({ where: counted, _count: { _all: true }, _sum: { total: true, deliveryFee: true } }),
    prisma.creditRecord.aggregate({ where: { kind: "REFUND", createdAt: { gte: since } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.orderEvent.count({ where: { toStatus: "DELIVERED", at: { gte: since } } }),
    prisma.orderEvent.count({ where: { toStatus: "FAILED_DELIVERY", at: { gte: since } } }),
    prisma.order.count({ where: { cancelledAt: { gte: since } } }),
  ]);
  const orders = totals._count._all;
  const revenue = totals._sum.total ?? 0;
  return {
    orders,
    revenue,
    deliveryFees: totals._sum.deliveryFee ?? 0,
    averageOrder: orders ? Math.round(revenue / orders) : 0,
    refunds: { amount: refunds._sum.amount ?? 0, count: refunds._count._all },
    deliveries: { delivered, failed, failRate: delivered + failed ? failed / (delivered + failed) : 0 },
    cancelled,
    byZone: byZone.map((z) => ({ label: z.zoneName, orders: z._count._all, revenue: z._sum.total ?? 0 })),
    byType: byType.map((t) => ({ label: t.orderType === "ONE_OFF" ? "Cart orders" : "Basket orders", orders: t._count._all, revenue: t._sum.total ?? 0 })),
  };
}

/** Best sellers by revenue, with quantity in the product's own terms. */
export async function topProducts(days: number, limit = 10) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.$queryRaw<{ id: string; name: string; soldAs: string; referenceWeightG: number | null; qty: bigint; revenue: bigint }[]>`
    SELECT p.id, p.name, p."soldAs", p."referenceWeightG", sum(oi.quantity) AS qty, sum(oi.quantity * oi."unitPrice") AS revenue
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Product" p ON p.id = oi."productId"
    WHERE o."createdAt" >= ${since} AND o."paidAt" IS NOT NULL AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY p.id ORDER BY revenue DESC LIMIT ${limit}`;
  return rows.map((r) => ({ name: r.name, stock: orderToStock(Number(r.qty), r), soldAs: r.soldAs, revenue: Number(r.revenue) }));
}

/** Waste by product, in stock units, with an estimate at cost where a cost is set. */
export async function wasteByProduct(days: number, limit = 10) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.stockMovement.groupBy({ by: ["productId"], where: { kind: "WASTE", at: { gte: since } }, _sum: { quantity: true }, _count: { _all: true } });
  const products = await prisma.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } }, select: { id: true, name: true, soldAs: true } });
  const meta = new Map(products.map((p) => [p.id, p]));
  return rows
    .map((r) => ({ name: meta.get(r.productId)?.name ?? "?", soldAs: meta.get(r.productId)?.soldAs ?? "SINGLE", quantity: -(r._sum.quantity ?? 0), entries: r._count._all }))
    .sort((a, b) => b.entries - a.entries)
    .slice(0, limit);
}

export async function memberStats(days: number) {
  const since = new Date(Date.now() - days * DAY);
  const [tiers, joined, cancelled, pending, customers, newCustomers] = await Promise.all([
    prisma.subscriptionTier.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { users: { where: { erasedAt: null } } } } } }),
    prisma.auditEvent.count({ where: { action: { in: ["subscriptions.request_approved", "plan.started"] }, at: { gte: since } } }),
    prisma.auditEvent.count({ where: { action: "plan.cancelled", at: { gte: since } } }),
    prisma.planRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { erasedAt: null } }),
    prisma.user.count({ where: { erasedAt: null, createdAt: { gte: since } } }),
  ]);
  return {
    byTier: tiers.map((t) => ({ label: t.name, members: t._count.users, monthly: t._count.users * t.monthlyFee })),
    members: tiers.reduce((s, t) => s + t._count.users, 0),
    monthlyRevenue: tiers.reduce((s, t) => s + t._count.users * t.monthlyFee, 0),
    joined,
    cancelled,
    pending,
    customers,
    newCustomers,
  };
}

export async function demandSignals(days: number) {
  const since = new Date(Date.now() - days * DAY);
  const [waitlist, waitlistRecent, unstocked, saved, threads, messages, kachiUsers] = await Promise.all([
    prisma.waitlistSignup.groupBy({ by: ["zoneRequested"], _count: { _all: true }, orderBy: { _count: { zoneRequested: "desc" } }, take: 12 }),
    prisma.waitlistSignup.count({ where: { createdAt: { gte: since } } }),
    prisma.unstockedIngredientRequest.findMany({ orderBy: [{ requestCount: "desc" }, { lastRequestedAt: "desc" }], take: 25 }),
    prisma.savedRecipe.groupBy({ by: ["recipeId"], _count: { _all: true }, orderBy: { _count: { recipeId: "desc" } }, take: 10 }),
    prisma.assistantThread.count({ where: { createdAt: { gte: since } } }),
    prisma.assistantMessage.count({ where: { role: "USER", createdAt: { gte: since } } }),
    prisma.assistantThread.groupBy({ by: ["userId"], where: { updatedAt: { gte: since } } }).then((r) => r.length),
  ]);
  const recipes = await prisma.recipe.findMany({ where: { id: { in: saved.map((s) => s.recipeId) } }, select: { id: true, title: true } });
  const title = new Map(recipes.map((r) => [r.id, r.title]));
  return {
    waitlist: waitlist.map((w) => ({ label: w.zoneRequested ?? "Not given", count: w._count._all })),
    waitlistRecent,
    unstocked: unstocked.map((u) => ({ term: u.term, count: u.requestCount, last: u.lastRequestedAt })),
    saved: saved.map((s) => ({ label: title.get(s.recipeId) ?? "Removed recipe", count: s._count._all })),
    kachi: { threads, messages, users: kachiUsers },
  };
}
