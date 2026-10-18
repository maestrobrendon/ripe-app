import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { cutoffFor, nextDeliveryDate } from "@/lib/delivery-dates";
import type { Basket, DeliveryZone } from "@/generated/prisma/client";
import type { DeliveryDay } from "@/generated/prisma/enums";

/*
 * A delivery's week. Each delivery (the Basket table) runs on one of its
 * area's days and closes at the area's cutoff hour the day before. Nothing is
 * ordered on its own: the customer confirms each week. A week can be skipped,
 * and one order is placed per delivery per date.
 *
 * Skips are kept in ShoppingWindow, one row per delivery per date:
 * opensAt = the delivery date (UTC midnight), closesAt = its cutoff.
 */

const WEEK = 7 * 86_400_000;
const LIVE_ORDER = { notIn: ["CANCELLED", "REFUNDED"] as ("CANCELLED" | "REFUNDED")[] };

export type CycleZone = Pick<DeliveryZone, "id" | "slug" | "name" | "area" | "deliveryDays" | "cutoffHour" | "deliveryFee">;

export type DeliveryCycle = {
  zone: CycleZone | null;
  /** The day this delivery runs on, always one of the area's days. */
  day: DeliveryDay;
  /** The next date it can still be ordered for (UTC midnight), or null with no area. */
  date: Date | null;
  /** When changes for that date close. */
  cutoff: Date | null;
  /** The date just before `date`, if the customer skipped it. */
  skippedDate: Date | null;
};

/** The area a customer's deliveries go to: their default address's area, else the area on their account. Once per render. */
export const zoneForUser = cache(async (userId: string): Promise<CycleZone | null> => {
  const select = { id: true, slug: true, name: true, area: true, deliveryDays: true, cutoffHour: true, deliveryFee: true, isServed: true };
  const [address, account] = await Promise.all([
    prisma.address.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], select: { zone: { select } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { deliveryZone: { select } } }),
  ]);
  const zone = address?.zone ?? account?.deliveryZone ?? null;
  return zone && zone.isServed ? zone : null;
});

/** The day a delivery runs on in this area: its own, if the area has it, else the area's first. */
export function dayIn(zone: CycleZone | null, day: DeliveryDay): DeliveryDay {
  if (!zone || zone.deliveryDays.length === 0 || zone.deliveryDays.includes(day)) return day;
  return zone.deliveryDays[0];
}

export async function getDeliveryCycle(basket: Pick<Basket, "id" | "deliveryDay">, zone: CycleZone | null, now = new Date()): Promise<DeliveryCycle> {
  const day = dayIn(zone, basket.deliveryDay);
  if (!zone) return { zone, day, date: null, cutoff: null, skippedDate: null };

  const first = nextDeliveryDate(day, zone.cutoffHour, now);
  const horizon = new Date(first.getTime() + 8 * WEEK);
  const [skips, orders] = await Promise.all([
    prisma.shoppingWindow.findMany({ where: { basketId: basket.id, status: "SKIPPED", opensAt: { gte: first, lt: horizon } }, select: { opensAt: true } }),
    prisma.order.findMany({ where: { basketId: basket.id, status: LIVE_ORDER, deliveryDate: { gte: first, lt: horizon } }, select: { deliveryDate: true } }),
  ]);
  const skipped = new Set(skips.map((s) => s.opensAt.getTime()));
  const ordered = new Set(orders.map((o) => o.deliveryDate.getTime()));

  let date = first;
  let skippedDate: Date | null = null;
  for (let i = 0; i < 8 && (skipped.has(date.getTime()) || ordered.has(date.getTime())); i++) {
    if (skipped.has(date.getTime())) skippedDate = date;
    date = new Date(date.getTime() + WEEK);
  }
  return { zone, day, date, cutoff: cutoffFor(date, zone.cutoffHour), skippedDate };
}

/** Skip (or stop skipping) one delivery date. */
export async function setDateSkipped(basket: Pick<Basket, "id" | "userId">, date: Date, cutoff: Date, skipped: boolean) {
  const row = await prisma.shoppingWindow.findFirst({ where: { basketId: basket.id, opensAt: date } });
  if (row) await prisma.shoppingWindow.update({ where: { id: row.id }, data: { status: skipped ? "SKIPPED" : "OPEN", closesAt: cutoff } });
  else if (skipped) await prisma.shoppingWindow.create({ data: { basketId: basket.id, userId: basket.userId, opensAt: date, closesAt: cutoff, status: "SKIPPED" } });
}

/**
 * The customer's orders they still care about, from any delivery (or from
 * before deliveries existed): not finished, or delivered in the last two days.
 */
export function liveOrdersFor(userId: string, now = new Date()) {
  return prisma.order.findMany({
    where: {
      userId,
      OR: [
        { status: { in: ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY", "FAILED_DELIVERY"] } },
        { status: "DELIVERED", deliveredAt: { gte: new Date(now.getTime() - 2 * 86_400_000) } },
      ],
    },
    orderBy: { deliveryDate: "asc" },
    include: { items: { include: { product: { select: { name: true, imageEmoji: true, cloudinaryPublicId: true } } } }, deliveryRun: { include: { rider: true } }, deliveryZone: { select: { cutoffHour: true } } },
  });
}
