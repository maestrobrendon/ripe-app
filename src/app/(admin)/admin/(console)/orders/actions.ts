"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { canRefundFrom, STATUS_LABEL } from "@/lib/order-status";
import { sendRefundEmail } from "@/lib/customer-emails";
import { changeOrderStatus, ORDER_CONFLICT } from "@/lib/admin/order-ops";
import type { OrderStatus } from "@/generated/prisma/enums";

/*
 * Order actions. Every change names the order version the staff member was
 * looking at; if someone else changed the order since, nothing is written and
 * they're asked to reload. Each change lands on the order's timeline, in the
 * audit log, and (where the customer should know) in their inbox.
 */

const id = z.string().min(1).max(40);
const CONFLICT = ORDER_CONFLICT;

function done(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function setOrderStatus(input: { orderId: string; to: string; version: number; note?: string }): Promise<ActionResult> {
  return staffAction(null, async (ctx) => {
    const parsed = z
      .object({ orderId: id, to: z.enum(Object.keys(STATUS_LABEL) as [OrderStatus, ...OrderStatus[]]), version: z.number().int().min(0), note: z.string().trim().max(500).optional() })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That change isn't valid." };
    const r = await changeOrderStatus(ctx, parsed.data);
    if (r.ok) done(parsed.data.orderId);
    return r;
  });
}

export async function recordRefund(input: { orderId: string; version: number; amount: number; method: string; reason: string }): Promise<ActionResult> {
  return staffAction("orders.refund", async (ctx) => {
    const parsed = z
      .object({ orderId: id, version: z.number().int().min(0), amount: z.number().int().positive().max(100_000_000), method: z.string().trim().min(2).max(80), reason: z.string().trim().min(3).max(500) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Enter the amount in naira, how it was paid back, and why." };
    const { orderId, version, amount, method, reason } = parsed.data;

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { credits: { where: { kind: "REFUND" } } } });
    if (!order) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
    if (order.version !== version) return CONFLICT;
    if (!order.paidAt) return { ok: false, code: "CONFLICT", error: "This order was never paid, so there's nothing to refund." };
    if (!canRefundFrom(order.status)) return { ok: false, code: "CONFLICT", error: "Refunds are recorded once an order is delivered, cancelled or failed." };
    const refunded = order.credits.reduce((s, c) => s + c.amount, 0);
    if (refunded + amount > order.total) {
      return { ok: false, code: "INVALID", error: `That's more than is left to refund (₦${(order.total - refunded).toLocaleString("en-NG")}).` };
    }
    const full = refunded + amount === order.total;

    const ok = await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({ where: { id: orderId, version }, data: { version: { increment: 1 }, ...(full && { status: "REFUNDED" }) } });
      if (count === 0) return false;
      await tx.creditRecord.create({ data: { kind: "REFUND", userId: order.userId, orderId, amount, method, reason, staffId: ctx.staff.id, staffName: ctx.staff.name } });
      await tx.orderEvent.create({
        data: {
          orderId,
          kind: "REFUND",
          ...(full && { fromStatus: order.status, toStatus: "REFUNDED" }),
          note: `₦${amount.toLocaleString("en-NG")} by ${method}: ${reason}`,
          staffId: ctx.staff.id,
          actorName: ctx.staff.name,
        },
      });
      return true;
    });
    if (!ok) return CONFLICT;

    await auditStaff(ctx, {
      action: "orders.refund_recorded",
      targetType: "Order",
      targetId: orderId,
      summary: `₦${amount.toLocaleString("en-NG")} refunded on #${orderId.slice(-8).toUpperCase()} by ${method}${full ? " (full)" : ""}`,
      diff: { amount, method, reason },
    });
    await sendRefundEmail(order, amount, method);
    done(orderId);
    return { ok: true, data: undefined };
  });
}

export async function saveInternalNote(input: { orderId: string; note: string }): Promise<ActionResult> {
  return staffAction("orders.notes", async (ctx) => {
    const parsed = z.object({ orderId: id, note: z.string().trim().max(2000) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Notes can be up to 2,000 characters." };
    const { orderId, note } = parsed.data;
    const { count } = await prisma.order.updateMany({ where: { id: orderId }, data: { internalNote: note || null } });
    if (!count) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
    await prisma.orderEvent.create({ data: { orderId, kind: "NOTE", note: note ? "Updated the staff note" : "Cleared the staff note", staffId: ctx.staff.id, actorName: ctx.staff.name } });
    await auditStaff(ctx, { action: "orders.note_saved", targetType: "Order", targetId: orderId, summary: "Staff note updated" });
    done(orderId);
    return { ok: true, data: undefined };
  });
}

export async function addOrderComment(input: { orderId: string; note: string }): Promise<ActionResult> {
  return staffAction("orders.notes", async (ctx) => {
    const parsed = z.object({ orderId: id, note: z.string().trim().min(1).max(500) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Write something (up to 500 characters)." };
    const { orderId, note } = parsed.data;
    if (!(await prisma.order.count({ where: { id: orderId } }))) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
    await prisma.orderEvent.create({ data: { orderId, kind: "NOTE", note, staffId: ctx.staff.id, actorName: ctx.staff.name } });
    done(orderId);
    return { ok: true, data: undefined };
  });
}

/** Shows the order's phone and email in full, once, on the record. */
export async function revealOrderContact(orderId: string): Promise<ActionResult<{ phone: string; email: string | null }>> {
  return staffAction("customers.reveal_pii", async (ctx) => {
    const order = await prisma.order.findUnique({ where: { id: String(orderId).slice(0, 40) }, select: { id: true, customerPhone: true, customerEmail: true, userId: true } });
    if (!order) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
    await auditStaff(ctx, { action: "customers.pii_revealed", targetType: "Order", targetId: order.id, summary: `Revealed contact details on order #${order.id.slice(-8).toUpperCase()}` });
    return { ok: true, data: { phone: order.customerPhone, email: order.customerEmail } };
  });
}
