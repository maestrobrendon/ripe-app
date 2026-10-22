import type { OrderStatus } from "@/generated/prisma/enums";
import type { Permission } from "@/lib/admin/permissions";

/*
 * The order lifecycle, in one place: every status, the moves allowed between
 * them, which admin permission each move needs, and how customers see it.
 * Pure and client-safe; the admin's server actions enforce it, the customer
 * pages and Kachi only read the labels.
 *
 *   RECEIVED → CONFIRMED → PICKING → PACKED → OUT_FOR_DELIVERY → DELIVERED
 *                                               ↘ FAILED_DELIVERY ↺ (retry)
 *   any step before the van leaves → CANCELLED
 *   DELIVERED / CANCELLED → REFUNDED (only through a recorded refund)
 */

export const ORDER_STATUSES = [
  "RECEIVED",
  "CONFIRMED",
  "PICKING",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_DELIVERY",
  "CANCELLED",
  "REFUNDED",
] as const satisfies readonly OrderStatus[];

/** Staff-facing names. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: "Received",
  CONFIRMED: "Confirmed",
  PICKING: "Picking",
  PACKED: "Packed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED_DELIVERY: "Delivery failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/** Still to be delivered: what Operations is working on. */
export const OPEN_STATUSES: OrderStatus[] = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY", "FAILED_DELIVERY"];

/** Moves and the permissions that allow them (any one of the list). */
const TRANSITIONS: Partial<Record<OrderStatus, Partial<Record<OrderStatus, Permission[]>>>> = {
  RECEIVED: { CONFIRMED: ["orders.update_status"], CANCELLED: ["orders.cancel"] },
  CONFIRMED: { PICKING: ["orders.update_status", "fulfilment.pack"], CANCELLED: ["orders.cancel"] },
  PICKING: { PACKED: ["orders.update_status", "fulfilment.pack"], CANCELLED: ["orders.cancel"] },
  PACKED: {
    OUT_FOR_DELIVERY: ["orders.update_status", "delivery.update_status"],
    PICKING: ["orders.update_status", "fulfilment.pack"],
    CANCELLED: ["orders.cancel"],
  },
  OUT_FOR_DELIVERY: { DELIVERED: ["orders.update_status", "delivery.update_status"], FAILED_DELIVERY: ["orders.update_status", "delivery.update_status"] },
  FAILED_DELIVERY: { OUT_FOR_DELIVERY: ["orders.update_status", "delivery.update_status"], CANCELLED: ["orders.cancel"] },
  // REFUNDED is reached only by recording a refund (orders.refund), never as a bare status change.
};

/** The statuses `from` can move to, regardless of who is asking. */
export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return Object.keys(TRANSITIONS[from] ?? {}) as OrderStatus[];
}

/** Permissions that allow from → to, or null when the move isn't allowed at all. */
export function transitionPermissions(from: OrderStatus, to: OrderStatus): Permission[] | null {
  return TRANSITIONS[from]?.[to] ?? null;
}

/** Whether a holder of `has` may move an order from → to. */
export function canTransition(from: OrderStatus, to: OrderStatus, has: (p: Permission) => boolean): boolean {
  const perms = transitionPermissions(from, to);
  return perms !== null && perms.some(has);
}

/** A refund can be recorded once the order is paid and either delivered, cancelled or failed. */
export function canRefundFrom(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CANCELLED" || status === "FAILED_DELIVERY" || status === "REFUNDED";
}

/* ------------------------------ customer view ----------------------------- */

/** The four steps a customer sees; staff detail folds into them. */
export const CUSTOMER_STEPS = ["Received", "Being packed", "On the way", "Delivered"] as const;

const STEP_INDEX: Partial<Record<OrderStatus, number>> = {
  RECEIVED: 0,
  CONFIRMED: 0,
  PICKING: 1,
  PACKED: 1,
  OUT_FOR_DELIVERY: 2,
  FAILED_DELIVERY: 2,
  DELIVERED: 3,
};

/** Which customer step an order is on, or null when it left the normal path (cancelled, refunded). */
export function customerStep(status: OrderStatus): number | null {
  return STEP_INDEX[status] ?? null;
}

/** The short label a customer sees for an order. */
export function customerStatusLabel(status: OrderStatus): string {
  if (status === "FAILED_DELIVERY") return "Delivery missed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "REFUNDED") return "Refunded";
  return CUSTOMER_STEPS[STEP_INDEX[status] ?? 0];
}
