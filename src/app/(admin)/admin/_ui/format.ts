import type { OrderStatus } from "@/generated/prisma/enums";

/* Shared admin formatting. Times are always shown in Lagos time. */

const TZ = "Africa/Lagos";

export const when = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(new Date(d)) : "—";

export const dayDate = (d: Date | string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(d));

export const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** The short order reference customers see: last 8 characters, upper case. */
export const orderRef = (id: string) => `#${id.slice(-8).toUpperCase()}`;

export function statusTone(s: OrderStatus): "neutral" | "good" | "bad" | "warn" {
  if (s === "DELIVERED") return "good";
  if (s === "CANCELLED" || s === "FAILED_DELIVERY" || s === "REFUNDED") return "bad";
  if (s === "RECEIVED") return "warn";
  return "neutral";
}

/** Lagos midnight for a yyyy-mm-dd string, as a UTC instant (Lagos is UTC+1 all year). */
export function lagosDayStart(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** n days before now. */
export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export const one = (v: string | string[] | undefined, max = 120) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, max) || undefined;
