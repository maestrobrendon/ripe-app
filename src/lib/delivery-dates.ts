import type { DeliveryDay } from "@/generated/prisma/enums";

/*
 * Delivery dates and order cutoffs, in Lagos time (UTC+1 all year, no DST).
 *
 * A delivery date is stored as UTC midnight of its calendar day, so it reads
 * as the same date whether it's formatted in UTC (the server) or in Lagos.
 * Orders for a delivery day close at the area's cutoff hour, Lagos time, on
 * the day before.
 */

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 86_400_000;
export const DOW: Record<DeliveryDay, number> = { MONDAY: 1, WEDNESDAY: 3, FRIDAY: 5 };

/** The Lagos calendar date of an instant, as UTC midnight of that date. */
export function lagosDate(now: Date): Date {
  const l = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()));
}

/** When orders for a delivery date close: cutoffHour (Lagos) on the day before. */
export function cutoffFor(deliveryDate: Date, cutoffHour: number): Date {
  return new Date(deliveryDate.getTime() - DAY_MS + cutoffHour * 3_600_000 - LAGOS_OFFSET_MS);
}

/** The first delivery date on `day` whose cutoff hasn't passed. */
export function nextDeliveryDate(day: DeliveryDay, cutoffHour: number, now: Date = new Date()): Date {
  const today = lagosDate(now);
  const diff = (DOW[day] - today.getUTCDay() + 7) % 7 || 7;
  let candidate = new Date(today.getTime() + diff * DAY_MS);
  // Closed already (it's past the cutoff the day before): the week after.
  while (now >= cutoffFor(candidate, cutoffHour)) candidate = new Date(candidate.getTime() + 7 * DAY_MS);
  return candidate;
}

/** yyyy-mm-dd for a stored delivery date. */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A yyyy-mm-dd string as a stored delivery date, or null. */
export function parseYmd(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
