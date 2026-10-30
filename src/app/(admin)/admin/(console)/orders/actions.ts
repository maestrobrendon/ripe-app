"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { canRefundFrom, STATUS_LABEL } from "@/lib/order-status";
import { sendRefundEmail } from "@/lib/customer-emails";
import { changeOrderStatus, ORDER_CONFLICT } from "@/lib/admin/order-ops";
import { can, type Role } from "@/lib/admin/permissions";
import { grantCredit } from "@/lib/credit";
import { notify } from "@/lib/notify";
import { formatNaira } from "@/lib/format";
import { orderRef } from "@/lib/delivery-labels";
import { refundTransaction } from "@/lib/paystack";
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

export async function recordRefund(input: { orderId: string; version: number; amount: number; method: string; reason: string; viaPaystack?: boolean }): Promise<ActionResult> {
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

    // Paid online: Paystack sends the money back first, and only then is it recorded.
    let paidBackBy = method;
    if (input.viaPaystack) {
      const payment = await prisma.payment.findFirst({ where: { orderId, status: "SUCCESS" }, orderBy: { paidAt: "desc" } });
      if (!payment) return { ok: false, code: "CONFLICT", error: "This order wasn't paid through Paystack. Untick the box and record how you paid it back." };
      try {
        await refundTransaction(payment.reference, amount, `${orderRef(orderId)}: ${reason}`);
      } catch (e) {
        return { ok: false, code: "CONFLICT", error: `Paystack didn't accept the refund: ${(e as Error).message}. Nothing was recorded.` };
      }
      await prisma.payment.update({ where: { id: payment.id }, data: { refundedAmount: { increment: amount } } });
      paidBackBy = `Paystack, back to the ${payment.channel === "card" ? "card" : "account"} they paid with`;
    }

    const ok = await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({ where: { id: orderId, version }, data: { version: { increment: 1 }, ...(full && { status: "REFUNDED" }) } });
      if (count === 0) return false;
      await tx.creditRecord.create({ data: { kind: "REFUND", userId: order.userId, orderId, amount, method: paidBackBy, reason, staffId: ctx.staff.id, staffName: ctx.staff.name } });
      await tx.orderEvent.create({
        data: {
          orderId,
          kind: "REFUND",
          ...(full && { fromStatus: order.status, toStatus: "REFUNDED" }),
          note: `₦${amount.toLocaleString("en-NG")} by ${paidBackBy}: ${reason}`,
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
      summary: `₦${amount.toLocaleString("en-NG")} refunded on #${orderId.slice(-8).toUpperCase()} by ${paidBackBy}${full ? " (full)" : ""}`,
      diff: { amount, method: paidBackBy, reason },
    });
    await sendRefundEmail(order, amount, paidBackBy);
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
export async function revealOrderContact(orderId: string): Promise<ActionResult<{ phone: string; email: string | null; altPhone: string | null }>> {
  return staffAction("customers.reveal_pii", async (ctx) => {
    const order = await prisma.order.findUnique({ where: { id: String(orderId).slice(0, 40) }, select: { id: true, customerPhone: true, customerEmail: true, altPhone: true, userId: true } });
    if (!order) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
    await auditStaff(ctx, { action: "customers.pii_revealed", targetType: "Order", targetId: order.id, summary: `Revealed contact details on order #${order.id.slice(-8).toUpperCase()}` });
    return { ok: true, data: { phone: order.customerPhone, email: order.customerEmail, altPhone: order.altPhone } };
  });
}

/**
 * A transfer arrived (or cash came back from the rider): the order is paid.
 * Pay-on-delivery orders are marked paid automatically when delivered; this
 * is for transfers and for anything staff collect by hand.
 */
export async function markOrderPaid(input: { orderId: string; version: number }): Promise<ActionResult> {
  return staffAction("orders.refund", async (ctx) => {
    const parsed = z.object({ orderId: id, version: z.number().int().min(0) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That change isn't valid." };
    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
    if (!order) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
    if (order.paidAt) return { ok: false, code: "CONFLICT", error: "This order is already marked paid." };
    if (order.status === "CANCELLED" || order.status === "REFUNDED") return { ok: false, code: "CONFLICT", error: "A cancelled order isn't paid for." };
    const { count } = await prisma.order.updateMany({ where: { id: order.id, version: parsed.data.version, paidAt: null }, data: { paidAt: new Date(), version: { increment: 1 } } });
    if (!count) return CONFLICT;
    await prisma.orderEvent.create({ data: { orderId: order.id, kind: "NOTE", note: `Marked paid (${order.paymentMethod})`, staffId: ctx.staff.id, actorName: ctx.staff.name } });
    await auditStaff(ctx, { action: "orders.marked_paid", targetType: "Order", targetId: order.id, summary: `${orderRef(order.id)} marked paid, ${formatNaira(order.total)}` });
    done(order.id);
    return { ok: true, data: undefined };
  });
}

/**
 * Close a problem the customer reported: say what was done, and optionally
 * give account credit (it comes off their next order). The customer is told.
 */
export async function resolveIssue(input: { issueId: string; resolution: string; credit: number }): Promise<ActionResult> {
  return staffAction("orders.notes", async (ctx) => {
    const parsed = z
      .object({ issueId: id, resolution: z.string().trim().min(3).max(300), credit: z.number().int().min(0).max(1_000_000) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Say what was done (a few words), and any credit in naira." };
    const { issueId, resolution, credit } = parsed.data;
    if (credit > 0 && !can(ctx.staff.role as Role, "orders.refund")) return { ok: false, code: "FORBIDDEN", error: "Your role can't give credit. Ask Finance or an admin." };

    const issue = await prisma.orderIssue.findUnique({ where: { id: issueId }, include: { order: { select: { id: true, userId: true, customerPhone: true, customerEmail: true } } } });
    if (!issue) return { ok: false, code: "INVALID", error: "That report doesn't exist." };
    if (issue.status === "RESOLVED") return { ok: false, code: "CONFLICT", error: "This one is already sorted." };

    const text = credit > 0 ? `${resolution}. ${formatNaira(credit)} credit added to your account.` : resolution;
    const { count } = await prisma.orderIssue.updateMany({ where: { id: issue.id, status: "OPEN" }, data: { status: "RESOLVED", resolution: text, resolvedAt: new Date() } });
    if (!count) return { ok: false, code: "CONFLICT", error: "Someone else just sorted this one." };
    if (credit > 0 && issue.order.userId) {
      await grantCredit({ userId: issue.order.userId, amount: credit, reason: `Put right: ${resolution}`.slice(0, 300), orderId: issue.order.id, staffId: ctx.staff.id, staffName: ctx.staff.name });
    }
    await prisma.orderEvent.create({ data: { orderId: issue.order.id, kind: "NOTE", note: `Problem sorted: ${text}`, staffId: ctx.staff.id, actorName: ctx.staff.name } });
    await auditStaff(ctx, { action: "orders.issue_resolved", targetType: "Order", targetId: issue.order.id, summary: `Issue resolved${credit ? ` with ${formatNaira(credit)} credit` : ""}` });
    const ref = orderRef(issue.order.id);
    await notify({
      userId: issue.order.userId,
      kind: "issue.resolved",
      dedupeKey: `issue.resolved:${issue.id}`,
      essential: true,
      email: { to: issue.order.customerEmail, subject: `About order ${ref}`, text: `Thanks for telling us about order ${ref}. ${text}` },
      whatsapp: { to: issue.order.customerPhone, text: `Basket: about order ${ref}. ${text}` },
    }).catch(() => {});
    done(issue.order.id);
    return { ok: true, data: undefined };
  });
}

