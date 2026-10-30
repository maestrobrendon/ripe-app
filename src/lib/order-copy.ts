import type { OrderStatus } from "@/generated/prisma/enums";
import { DELIVERY_WINDOW, cutoffLabel, longDate } from "@/lib/delivery-labels";

/** Today in Lagos, as YYYY-MM-DD. */
const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);

/** Whether a stored delivery date is today in Lagos. */
const isToday = (dateIso: string) => dateIso.slice(0, 10) === lagosToday();

/** Whether a stored delivery date is a day that has already gone. */
const isPast = (dateIso: string) => dateIso.slice(0, 10) < lagosToday();

const OPEN: OrderStatus[] = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY"];

/*
 * How an order's state reads to the customer, wherever it's shown (Home,
 * Orders, the order page). Client-safe. "Delivered" is only ever said once
 * it has been.
 */

/**
 * Placed but not paid, so not confirmed yet: an order only counts once it's
 * paid. Old pay-on-delivery orders (from before it was retired) were
 * confirmed without paying, so they never wait.
 */
export function awaitingPayment(o: { paidAt: Date | string | null; paymentMethod: string; status: OrderStatus }): boolean {
  return !o.paidAt && o.status === "RECEIVED" && !/delivery/i.test(o.paymentMethod);
}

export type OrderForCopy = {
  status: OrderStatus;
  /** Placed but not paid yet (awaitingPayment above). */
  awaitingPayment?: boolean;
  deliveryDateIso: string;
  cutoffIso: string;
  canCancel: boolean;
  rider: { name: string } | null;
};

export function orderHeadline(o: OrderForCopy): { title: string; body: string } {
  const day = longDate(o.deliveryDateIso);
  // Never paid and its day has gone: it didn't go out, so it isn't "late".
  if (o.awaitingPayment && o.status === "RECEIVED" && isPast(o.deliveryDateIso)) {
    return { title: "Not paid in time", body: `This basket for ${day} wasn't paid, so it didn't go out. Confirm it again for your next delivery day.` };
  }
  // Its day has gone and it hasn't arrived: say so, never "arriving" on a past date.
  if (OPEN.includes(o.status) && isPast(o.deliveryDateIso)) {
    return { title: "Running late", body: `This was due ${day} and hasn't reached you yet. Message us and we'll sort it straight away.` };
  }
  if (o.awaitingPayment && o.status === "RECEIVED") {
    return { title: "Waiting for payment", body: `Your basket for ${day} is held for you. It's confirmed the moment it's paid, before ${cutoffLabel(o.cutoffIso)}.` };
  }
  switch (o.status) {
    case "RECEIVED":
    case "CONFIRMED":
      return {
        title: `Confirmed for ${day}`,
        body: o.canCancel ? `Need a change? Cancel before ${cutoffLabel(o.cutoffIso)}, edit, and confirm again.` : "We're getting it ready. It's checked by hand before it leaves.",
      };
    case "PICKING":
    case "PACKED":
      return { title: `Being packed for ${day}`, body: "Checked by hand before it leaves." };
    case "OUT_FOR_DELIVERY":
    {
      const when = isToday(o.deliveryDateIso) ? "today" : longDate(o.deliveryDateIso);
      return { title: "On its way to you", body: o.rider ? `${o.rider.name} is bringing it ${when}, ${DELIVERY_WINDOW}.` : `Arriving ${when}, ${DELIVERY_WINDOW}.` };
    }
    case "FAILED_DELIVERY":
      return { title: "We missed you", body: "We couldn't hand it over. We'll be in touch to arrange another time." };
    case "DELIVERED":
      return { title: "Delivered", body: "Everything right? If anything is bruised, wrong or missing, tell us and we'll put it right." };
    case "CANCELLED":
      return { title: "Cancelled", body: "This order won't be delivered." };
    case "REFUNDED":
      return { title: "Refunded", body: "We've refunded this order." };
  }
}

/** What an order's payment looks like to the customer. */
export function paymentLine(o: { paidAt: Date | string | null; paymentMethod: string; total: number; status: OrderStatus }, naira: (n: number) => string): string {
  // Orders from before payments were real carry a "(test mode)" label.
  o = { ...o, paymentMethod: o.paymentMethod.replace(/\s*\(test mode\)/i, "") };
  if (o.paidAt) return `Paid · ${o.paymentMethod}`;
  if (o.status === "CANCELLED" || o.status === "REFUNDED") return o.paymentMethod;
  if (o.status === "DELIVERED") return `${naira(o.total)} to pay · ${o.paymentMethod}`;
  if (/transfer/i.test(o.paymentMethod)) return `Bank transfer · waiting for ${naira(o.total)}`;
  if (/delivery/i.test(o.paymentMethod)) return `Pay ${naira(o.total)} when it arrives`;
  if (/online/i.test(o.paymentMethod)) return `${naira(o.total)} to pay online`;
  return o.paymentMethod;
}

/** The kinds of problem a customer can report, in their words. */
export const ISSUE_KINDS = [
  { id: "missing", label: "Something's missing" },
  { id: "damaged", label: "Bruised or damaged" },
  { id: "wrong", label: "Wrong item" },
  { id: "quality", label: "Not fresh enough" },
  { id: "late", label: "Late or no-show" },
  { id: "other", label: "Something else" },
] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number]["id"];
