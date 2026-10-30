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

/**
 * Days as a phrase: three or more in a row read as a range ("Thursday to
 * Saturday"), anything else as a list ("Tuesday and Friday").
 */
export function daysPhrase(days: DeliveryDay[]): string {
  const ordered = inWeekOrder(days);
  if (ordered.length === 0) return "";
  const idx = ordered.map((d) => WEEK_DAYS.indexOf(d));
  const run = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (run && ordered.length >= 3) return `${dayName(ordered[0])} to ${dayName(ordered[ordered.length - 1])}`;
  const names = ordered.map(dayName);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

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

type Named = { name: string | null; oneOff?: boolean };

/** A basket's name: what the customer called it, else "My basket". A one-time order is always "One-time order". */
export const basketName = (b: Named) => (b.oneOff ? "One-time order" : b.name?.trim() || "My basket");

/** What a basket is called in a list (the day is shown beside it, not in the name). */
export const deliveryName = (b: Named) => basketName(b);

/** How a basket reads in a sentence: "your basket", its own name ("For Mum"), or "your one-time order". */
export const orderPhrase = (b: Named) => (b.oneOff ? "your one-time order" : b.name?.trim() ? b.name.trim() : "your basket");

/**
 * What each of a customer's baskets is called in lists. Named ones keep their
 * name and a one-time order is "One-time order"; with more than one unnamed
 * basket, each is called by its day ("Saturday basket", "Saturday basket 2").
 */
export function basketLabels(baskets: { id: string; name: string | null; deliveryDay: DeliveryDay; oneOff?: boolean }[]) {
  const unnamed = baskets.filter((b) => !b.oneOff && !b.name?.trim());
  return new Map(
    baskets.map((b) => {
      if (b.oneOff || b.name?.trim() || unnamed.length < 2) return [b.id, basketName(b)];
      const n = unnamed.filter((u) => u.deliveryDay === b.deliveryDay).findIndex((u) => u.id === b.id);
      return [b.id, `${dayName(b.deliveryDay)} basket${n > 0 ? ` ${n + 1}` : ""}`];
    }),
  );
}

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
