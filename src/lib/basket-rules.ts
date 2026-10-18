import "server-only";
import { prisma } from "@/lib/prisma";
import { isMember } from "@/lib/order-container";
import { cutoffFor, DOW, lagosDate } from "@/lib/delivery-dates";
import type { CycleZone } from "@/lib/delivery";
import type { Basket } from "@/generated/prisma/client";
import type { DeliveryDay, OrderStatus } from "@/generated/prisma/enums";

/*
 * The basket model (founder, Oct 2026).
 *
 * A basket is a named collection of produce that comes every week, on its
 * own day: "My basket", "For Mum". Its items stay from week to week. A few
 * days before each delivery we remind the customer on WhatsApp, email and the
 * app to confirm it; they pay when it arrives (or by transfer). Nothing is
 * ever charged on its own, and a week that isn't confirmed by its cutoff
 * simply doesn't go out.
 *
 * Membership is what makes baskets repeat. A free account gets one trial
 * basket, delivered once, at market prices; after that, confirming a basket
 * needs a membership. Members run up to 3 baskets (Member Plus, any number).
 *
 * Weeks run in 4-week cycles, counted from when the membership started.
 */

const DAY = 86_400_000;
const CYCLE_DAYS = 28;
const LIVE: OrderStatus[] = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED_DELIVERY"];

/** A free account has used its trial once it has an order that wasn't cancelled. */
export async function trialUsed(userId: string) {
  return (await prisma.order.count({ where: { userId, status: { in: LIVE } } })) > 0;
}

export type ConfirmRight = { ok: true; trial: boolean } | { ok: false; reason: "trial-used" };

/** Whether this customer can confirm a basket's delivery right now. */
export async function confirmRight(user: { id: string; subscriptionTierId: string | null }): Promise<ConfirmRight> {
  if (isMember(user)) return { ok: true, trial: false };
  return (await trialUsed(user.id)) ? { ok: false, reason: "trial-used" } : { ok: true, trial: true };
}

export type CycleWeekState = "delivered" | "confirmed" | "on-the-way" | "skipped" | "missed" | "to-confirm" | "upcoming" | "before";
export type CycleWeek = { dateIso: string; state: CycleWeekState; orderId: string | null };

/** The first day of the current 4-week cycle (Lagos), counted from `anchor`. */
export function cycleStart(anchor: Date, now = new Date()): Date {
  const start = lagosDate(anchor).getTime();
  const today = lagosDate(now).getTime();
  const elapsed = Math.max(0, Math.floor((today - start) / DAY));
  return new Date(start + Math.floor(elapsed / CYCLE_DAYS) * CYCLE_DAYS * DAY);
}

/**
 * This basket's four weeks in the current cycle, each with what happened or
 * what's needed: delivered, confirmed, on the way, skipped, missed (closed
 * without a confirmation), waiting to be confirmed, still to come, or
 * before the basket existed.
 */
export async function basketCycle(
  basket: Pick<Basket, "id" | "createdAt">,
  day: DeliveryDay,
  zone: Pick<CycleZone, "cutoffHour"> | null,
  anchor: Date | null,
  now = new Date(),
): Promise<{ start: Date; weeks: CycleWeek[]; weekNumber: number }> {
  const start = cycleStart(anchor ?? basket.createdAt, now);
  // The basket's day in each of the cycle's four weeks.
  const firstOffset = (DOW[day] - start.getUTCDay() + 7) % 7;
  const dates = Array.from({ length: 4 }, (_, i) => new Date(start.getTime() + (firstOffset + i * 7) * DAY));
  const end = new Date(start.getTime() + CYCLE_DAYS * DAY);

  const [orders, skips] = await Promise.all([
    prisma.order.findMany({ where: { basketId: basket.id, deliveryDate: { gte: start, lt: end }, status: { in: LIVE } }, select: { id: true, deliveryDate: true, status: true } }),
    prisma.shoppingWindow.findMany({ where: { basketId: basket.id, status: "SKIPPED", opensAt: { gte: start, lt: end } }, select: { opensAt: true } }),
  ]);
  const cutoffHour = zone?.cutoffHour ?? 18;
  let nextOpenFound = false;

  const weeks = dates.map((d): CycleWeek => {
    const order = orders.find((o) => o.deliveryDate.getTime() === d.getTime());
    if (order) {
      const state: CycleWeekState = order.status === "DELIVERED" ? "delivered" : order.status === "OUT_FOR_DELIVERY" ? "on-the-way" : "confirmed";
      return { dateIso: d.toISOString(), state, orderId: order.id };
    }
    if (skips.some((s) => s.opensAt.getTime() === d.getTime())) return { dateIso: d.toISOString(), state: "skipped", orderId: null };
    const closes = cutoffFor(d, cutoffHour).getTime();
    if (closes <= basket.createdAt.getTime()) return { dateIso: d.toISOString(), state: "before", orderId: null };
    if (now.getTime() >= closes) return { dateIso: d.toISOString(), state: "missed", orderId: null };
    if (!nextOpenFound) {
      nextOpenFound = true;
      return { dateIso: d.toISOString(), state: "to-confirm", orderId: null };
    }
    return { dateIso: d.toISOString(), state: "upcoming", orderId: null };
  });

  const today = lagosDate(now).getTime();
  const weekNumber = Math.min(4, Math.floor((today - start.getTime()) / (7 * DAY)) + 1);
  return { start, weeks, weekNumber };
}
