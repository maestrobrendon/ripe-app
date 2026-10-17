import "server-only";
import { prisma } from "@/lib/prisma";
import { lagosDate, parseYmd, ymd } from "@/lib/delivery-dates";
import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * Delivery days from yesterday onward that still have orders in the given
 * statuses, with counts; and which day to show (the one asked for, else
 * today if it has work, else the next day that does).
 */
export async function workDays(statuses: OrderStatus[], asked?: string) {
  const today = lagosDate(new Date());
  const rows = await prisma.order.groupBy({
    by: ["deliveryDate"],
    where: { status: { in: statuses }, deliveryDate: { gte: new Date(today.getTime() - 86_400_000) } },
    _count: { _all: true },
    orderBy: { deliveryDate: "asc" },
    take: 14,
  });
  // Group by calendar day (older rows may carry a time of day).
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(ymd(r.deliveryDate), (counts.get(ymd(r.deliveryDate)) ?? 0) + r._count._all);
  const days = [...counts.entries()].map(([d, count]) => ({ ymd: d, count }));
  const askedDay = parseYmd(asked);
  const current = askedDay ? ymd(askedDay) : (days.find((d) => d.ymd >= ymd(today))?.ymd ?? days[days.length - 1]?.ymd ?? ymd(today));
  const start = parseYmd(current)!;
  return { days, current, range: { gte: start, lt: new Date(start.getTime() + 86_400_000) } };
}
