import type { DeliveryDay } from "@/generated/prisma/enums";

/*
 * How deliveries, dates and quantities read to a customer. Client-safe.
 * Delivery dates are stored as UTC midnight of their calendar day; cutoffs
 * are real instants, shown in Lagos time.
 */

export const DELIVERY_WINDOW = "9am to 5pm";

/** Every weekday a delivery can run on, in week order. Which ones an area uses is set per area in the admin. */
export const WEEK_DAYS: DeliveryDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const DAY_NAME: Record<DeliveryDay, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};
export const dayName = (d: DeliveryDay) => DAY_NAME[d] ?? d;
export const dayShort = (d: DeliveryDay) => dayName(d).slice(0, 3);
/** An area's days in week order, whatever order the admin ticked them in. */
export const inWeekOrder = (days: DeliveryDay[]) => WEEK_DAYS.filter((d) => days.includes(d));

const asDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

/** "Wednesday 22 Oct" for a stored delivery date. */
export const longDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(asDate(d));

/** "Wed 22 Oct" for a stored delivery date. */
export const shortDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(asDate(d));

/** "Tue 6pm" for a cutoff instant, in Lagos time. */
export function cutoffLabel(cutoff: Date | string): string {
  const c = asDate(cutoff);
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Africa/Lagos" }).format(c);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(c));
  const minute = Number(new Intl.DateTimeFormat("en-GB", { minute: "numeric", timeZone: "Africa/Lagos" }).format(c));
  const h12 = hour % 12 || 12;
  const time = hour === 0 && minute === 0 ? "midnight" : hour === 12 && minute === 0 ? "noon" : `${h12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour < 12 ? "am" : "pm"}`;
  return `${day} ${time}`;
}

/** "2 days left", "5 hours left", "40 minutes left". */
export function timeLeft(ms: number): string {
  if (ms <= 0) return "closed";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} minute${mins === 1 ? "" : "s"} left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** What a delivery is called in a list: its own name, else its day ("Wednesdays"). */
export const deliveryName = (b: { name: string | null }, day: DeliveryDay) => b.name?.trim() || `${dayName(day)}s`;

/** How a delivery reads in a sentence: "your Wednesday order", "your Mum's order". */
export const orderPhrase = (b: { name: string | null }, day: DeliveryDay) =>
  b.name?.trim() ? `your ${b.name.trim()} order` : `your ${dayName(day)} order`;

/** #ABCD1234, the reference customers see everywhere. */
export const orderRef = (id: string) => `#${id.slice(-8).toUpperCase()}`;

/*
 * Quantities in the words people use: "2 pieces", "1 bunch", "2 × 250g",
 * "3 kg", "1 pack of 6". Product units are written "per piece", "per 250g",
 * "per pair of 2" and so on.
 */
function plural(noun: string, n: number): string {
  if (n === 1) return noun;
  const [head, ...rest] = noun.split(" ");
  const tail = rest.length ? ` ${rest.join(" ")}` : "";
  if (/(ch|sh|x|s)$/.test(head)) return `${head}es${tail}`;
  if (/[^aeiou]y$/.test(head)) return `${head.slice(0, -1)}ies${tail}`;
  return `${head}s${tail}`;
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

export function quantityLabel(qty: number, unit: string): string {
  const u = unit.replace(/^per\s+/i, "").trim();
  if (!u) return fmtQty(qty);
  if (/^kg$/i.test(u)) return `${fmtQty(qty)} kg`;
  if (/^\d+$/.test(u)) return `${fmtQty(qty)} ${plural("pack", qty)} of ${u}`;
  if (/^\d/.test(u)) return `${fmtQty(qty)} × ${u}`;
  const pair = /^pair(?: of \d+)?$/i.exec(u);
  if (pair) return `${fmtQty(qty)} ${plural("pair", qty)}`;
  return `${fmtQty(qty)} ${plural(u, qty)}`;
}

/** "₦550 each", "₦1,200 per kg", "₦500 per 250g". */
export function unitPriceLabel(priceLabel: string, unit: string): string {
  const u = unit.replace(/^per\s+/i, "").trim();
  if (!u || /^(piece|each)$/i.test(u)) return `${priceLabel} each`;
  return `${priceLabel} per ${u}`;
}
