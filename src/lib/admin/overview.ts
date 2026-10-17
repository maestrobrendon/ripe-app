import "server-only";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { OFFERED } from "@/lib/product";
import { dailySales, demandSignals, memberStats, salesBreakdown } from "./insights";

/*
 * Everything the Overview dashboard draws, in one round of queries.
 * Aggregates only: no customer is named or identifiable, so every role with
 * dashboard.view (Analyst included) can see all of it. Lagos days (UTC+1).
 */

const DAY = 86_400_000;
const LAGOS = 3_600_000;

export const OVERVIEW_RANGES = [7, 30, 90] as const;

/** Lagos midnight today, as a UTC instant. */
function lagosToday(): Date {
  const now = new Date(Date.now() + LAGOS);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - LAGOS);
}

/** Change from `before` to `now` as a fraction, or null when there's nothing to compare against. */
function change(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null;
  return (now - before) / before;
}

const PIPELINE: OrderStatus[] = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY"];

export async function overview(days: number) {
  const today = lagosToday();
  const since = new Date(Date.now() - days * DAY);
  const lagosNow = new Date(Date.now() + LAGOS);
  const monthStart = new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth(), 1) - LAGOS);
  const monthEnd = new Date(Date.UTC(lagosNow.getUTCFullYear(), lagosNow.getUTCMonth() + 1, 1) - LAGOS);

  const [
    series,
    signups,
    sales,
    members,
    demand,
    ordersToday,
    paidToday,
    deliveredToday,
    pipeline,
    products,
    best,
    recent,
    calendar,
    recipes,
    zones,
  ] = await Promise.all([
    dailySales(days * 2),
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "createdAt" + interval '1 hour') AS day, count(*) AS n
      FROM "User" WHERE "createdAt" >= ${new Date(Date.now() - days * 2 * DAY)} AND "erasedAt" IS NULL
      GROUP BY 1`,
    salesBreakdown(days),
    memberStats(days),
    demandSignals(days),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.aggregate({ where: { createdAt: { gte: today }, paidAt: { not: null } }, _sum: { total: true } }),
    prisma.orderEvent.count({ where: { toStatus: "DELIVERED", at: { gte: today } } }),
    prisma.order.groupBy({ by: ["status"], where: { status: { in: [...PIPELINE, "FAILED_DELIVERY"] } }, _count: { _all: true } }),
    prisma.product.findMany({ where: OFFERED, select: { availability: true, stockOnHand: true, reorderPoint: true, name: true, imageEmoji: true, soldAs: true } }),
    prisma.$queryRaw<{ name: string; emoji: string; qty: bigint; revenue: bigint }[]>`
      SELECT p.name, p."imageEmoji" AS emoji, sum(oi.quantity) AS qty, sum(oi.quantity * oi."unitPrice") AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Product" p ON p.id = oi."productId"
      WHERE o."createdAt" >= ${since} AND o."paidAt" IS NOT NULL AND o.status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY p.id ORDER BY revenue DESC LIMIT 5`,
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, createdAt: true, total: true, status: true, zoneName: true, orderType: true, _count: { select: { items: true } } },
    }),
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`
      SELECT date_trunc('day', "deliveryDate" + interval '1 hour') AS day, count(*) AS n
      FROM "Order" WHERE "deliveryDate" >= ${monthStart} AND "deliveryDate" < ${monthEnd} AND status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY 1`,
    prisma.recipe.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.deliveryZone.count({ where: { isServed: true } }),
  ]);

  // The doubled series splits into the period shown and the one before it.
  const prev = series.slice(0, series.length - days);
  const cur = series.slice(series.length - days);
  const sum = (pts: typeof cur, k: "orders" | "revenue") => pts.reduce((s, p) => s + p[k], 0);
  const signupsByDay = new Map(signups.map((r) => [r.day.toISOString().slice(0, 10), Number(r.n)]));
  const signupSeries = series.map((p) => signupsByDay.get(p.day) ?? 0);
  const curSignups = signupSeries.slice(series.length - days);
  const prevSignups = signupSeries.slice(0, series.length - days);
  const total = (a: number[]) => a.reduce((s, n) => s + n, 0);

  const revenue = sum(cur, "revenue");
  const orders = sum(cur, "orders");
  const prevRevenue = sum(prev, "revenue");
  const prevOrders = sum(prev, "orders");
  const avg = orders ? Math.round(revenue / orders) : 0;
  const prevAvg = prevOrders ? Math.round(prevRevenue / prevOrders) : 0;

  // Orders by weekday across the period (Mon first), for the "busiest days" bars.
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  for (const p of cur) weekdays[(new Date(`${p.day}T00:00:00Z`).getUTCDay() + 6) % 7] += p.orders;

  const stock = { healthy: 0, low: 0, out: 0, untracked: 0 };
  for (const p of products) {
    if (p.availability === "OUT_OF_STOCK" || (p.reorderPoint !== null && p.stockOnHand <= 0)) stock.out++;
    else if (p.reorderPoint === null) stock.untracked++;
    else if (p.stockOnHand <= p.reorderPoint) stock.low++;
    else stock.healthy++;
  }
  const lowList = products
    .filter((p) => p.reorderPoint !== null && p.stockOnHand <= p.reorderPoint)
    .sort((a, b) => a.stockOnHand / Math.max(1, a.reorderPoint ?? 1) - b.stockOnHand / Math.max(1, b.reorderPoint ?? 1))
    .slice(0, 4);

  const statusCount = new Map(pipeline.map((p) => [p.status, p._count._all]));
  const recipeCount = new Map(recipes.map((r) => [r.status, r._count._all]));

  return {
    days,
    kpi: {
      revenue: { value: revenue, change: change(revenue, prevRevenue), spark: cur.map((p) => p.revenue) },
      orders: { value: orders, change: change(orders, prevOrders), spark: cur.map((p) => p.orders) },
      average: { value: avg, change: change(avg, prevAvg), spark: cur.map((p) => (p.orders ? p.revenue / p.orders : 0)) },
      customers: { value: total(curSignups), change: change(total(curSignups), total(prevSignups)), spark: curSignups },
    },
    series: cur,
    today: {
      orders: ordersToday,
      paid: paidToday._sum.total ?? 0,
      toPack: (statusCount.get("CONFIRMED") ?? 0) + (statusCount.get("PICKING") ?? 0),
      outForDelivery: statusCount.get("OUT_FOR_DELIVERY") ?? 0,
      delivered: deliveredToday,
    },
    pipeline: PIPELINE.map((s) => ({ status: s, count: statusCount.get(s) ?? 0 })),
    failed: statusCount.get("FAILED_DELIVERY") ?? 0,
    weekdays,
    stock: { ...stock, offered: products.length, lowList },
    members,
    sales,
    demand,
    best: best.map((b) => ({ name: b.name, emoji: b.emoji, qty: Number(b.qty), revenue: Number(b.revenue) })),
    recent: recent.map((o) => ({ id: o.id, createdAt: o.createdAt, total: o.total, status: o.status, zone: o.zoneName, items: o._count.items, type: o.orderType })),
    calendar: {
      year: lagosNow.getUTCFullYear(),
      month: lagosNow.getUTCMonth(),
      today: lagosNow.getUTCDate(),
      deliveries: Object.fromEntries(calendar.map((r) => [Number(r.day.toISOString().slice(8, 10)), Number(r.n)])) as Record<number, number>,
    },
    recipes: { published: recipeCount.get("PUBLISHED") ?? 0, draft: recipeCount.get("DRAFT") ?? 0 },
    zones,
  };
}

export type Overview = Awaited<ReturnType<typeof overview>>;
