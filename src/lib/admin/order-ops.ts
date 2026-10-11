import "server-only";
import { prisma } from "@/lib/prisma";
import { auditStaff, type ActionResult } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { canTransition, STATUS_LABEL } from "@/lib/order-status";
import { sendOrderStatusEmail } from "@/lib/customer-emails";
import { returnStockForOrder, takeStockForOrder } from "@/lib/stock";
import type { StaffContext } from "@/lib/admin/session";
import type { OrderStatus } from "@/generated/prisma/enums";

/*
 * Moving an order to a new status: the one path used by the order page,
 * fulfilment and delivery. Checks the lifecycle and the staff member's role,
 * refuses stale versions, moves stock (out at packing, back on cancel or
 * unpack), writes the timeline, audits, and emails the customer when they
 * should know.
 */

export const ORDER_CONFLICT = {
  ok: false as const,
  code: "CONFLICT" as const,
  error: "Someone else just changed this order. Reload to see the latest, then try again.",
};

export async function changeOrderStatus(
  ctx: StaffContext,
  input: { orderId: string; to: OrderStatus; version: number; note?: string | null },
): Promise<ActionResult> {
  const { orderId, to, version } = input;
  const note = input.note?.trim() || null;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
  if (order.version !== version) return ORDER_CONFLICT;
  const role = ctx.staff.role as Role;
  if (!canTransition(order.status, to, (p) => can(role, p))) {
    await auditStaff(ctx, { action: "security.forbidden", targetType: "Order", targetId: orderId, summary: `Tried ${order.status} → ${to}` });
    return { ok: false, code: "FORBIDDEN", error: `Your role can't move an order from ${STATUS_LABEL[order.status]} to ${STATUS_LABEL[to]}.` };
  }
  if (to === "CANCELLED" && !note) return { ok: false, code: "INVALID", error: "Say why the order is being cancelled. The customer sees this." };

  const actor = { id: ctx.staff.id, name: ctx.staff.name };
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, version, status: order.status },
      data: {
        status: to,
        version: { increment: 1 },
        ...(to === "DELIVERED" && { deliveredAt: now }),
        ...(to === "CANCELLED" && { cancelledAt: now, cancelReason: note }),
        // A cancelled order leaves its delivery run.
        ...(to === "CANCELLED" && { deliveryRunId: null, runSequence: null }),
      },
    });
    if (count === 0) return false;
    if (to === "PACKED") await takeStockForOrder(tx, orderId, actor);
    if (to === "CANCELLED") await returnStockForOrder(tx, orderId, actor, "Order cancelled");
    if (order.status === "PACKED" && to === "PICKING") await returnStockForOrder(tx, orderId, actor, "Unpacked");
    await tx.orderEvent.create({ data: { orderId, kind: "STATUS", fromStatus: order.status, toStatus: to, note, staffId: ctx.staff.id, actorName: ctx.staff.name } });
    return true;
  });
  if (!updated) return ORDER_CONFLICT;

  await auditStaff(ctx, {
    action: "orders.status_changed",
    targetType: "Order",
    targetId: orderId,
    summary: `#${orderId.slice(-8).toUpperCase()}: ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[to]}`,
    diff: { status: [order.status, to], ...(note && { note }) },
  });
  await sendOrderStatusEmail(order, to, note);
  return { ok: true, data: undefined };
}
