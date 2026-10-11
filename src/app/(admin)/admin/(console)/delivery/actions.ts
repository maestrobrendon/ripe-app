"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { changeOrderStatus } from "@/lib/admin/order-ops";
import { parseYmd } from "@/lib/delivery-dates";

/*
 * Delivery runs: a rider's ordered list of stops for one day. Planning and
 * ordering stops needs delivery.manage_runs; marking stops delivered or
 * missed goes through changeOrderStatus (delivery.update_status), the same
 * path as the order page.
 */

const DAY_MS = 86_400_000;
const id = z.string().min(1).max(40);

function done(runId?: string) {
  revalidatePath("/delivery", "layout");
  revalidatePath("/orders");
  if (runId) revalidatePath(`/delivery/runs/${runId}`);
}

export async function createRun(input: { day: string; name: string; riderId: string | null; orderIds: string[] }): Promise<ActionResult<{ id: string }>> {
  return staffAction("delivery.manage_runs", async (ctx) => {
    const parsed = z.object({ day: z.string(), name: z.string().trim().min(2).max(60), riderId: id.nullable(), orderIds: z.array(id).max(80) }).safeParse(input);
    const day = parsed.success ? parseYmd(parsed.data.day) : null;
    if (!parsed.success || !day) return { ok: false, code: "INVALID", error: "Give the run a name and a day." };
    const { name, riderId, orderIds } = parsed.data;
    if (riderId && !(await prisma.rider.count({ where: { id: riderId, active: true } }))) return { ok: false, code: "INVALID", error: "That rider isn't available." };

    const run = await prisma.$transaction(async (tx) => {
      const r = await tx.deliveryRun.create({ data: { day, name, riderId } });
      // Only orders for that day, not cancelled or delivered, and not already on another run.
      const eligible = await tx.order.findMany({
        where: { id: { in: orderIds }, deliveryRunId: null, deliveryDate: { gte: day, lt: new Date(day.getTime() + DAY_MS) }, status: { in: ["CONFIRMED", "PICKING", "PACKED", "FAILED_DELIVERY"] } },
        select: { id: true },
      });
      const order = orderIds.filter((o) => eligible.some((e) => e.id === o));
      for (const [i, oid] of order.entries()) await tx.order.update({ where: { id: oid }, data: { deliveryRunId: r.id, runSequence: i + 1 } });
      return { r, count: order.length };
    });
    await auditStaff(ctx, { action: "delivery.run_created", targetType: "DeliveryRun", targetId: run.r.id, summary: `${name} with ${run.count} stop(s)` });
    done(run.r.id);
    return { ok: true, data: { id: run.r.id } };
  });
}

async function loadRun(runId: string) {
  return prisma.deliveryRun.findUnique({ where: { id: runId }, include: { orders: { orderBy: { runSequence: "asc" }, select: { id: true, status: true, version: true, runSequence: true } } } });
}

/** Saves the stop order (and removes stops not in the list). Only while planning. */
export async function setStops(input: { runId: string; orderIds: string[] }): Promise<ActionResult> {
  return staffAction("delivery.manage_runs", async (ctx) => {
    const parsed = z.object({ runId: id, orderIds: z.array(id).max(80) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That stop list isn't valid." };
    const run = await loadRun(parsed.data.runId);
    if (!run) return { ok: false, code: "INVALID", error: "That run doesn't exist." };
    if (run.status !== "PLANNING") return { ok: false, code: "CONFLICT", error: "The run has left. Stops can't be reordered now." };
    const current = new Set(run.orders.map((o) => o.id));
    const keep = parsed.data.orderIds.filter((o) => current.has(o));
    await prisma.$transaction([
      prisma.order.updateMany({ where: { deliveryRunId: run.id, id: { notIn: keep } }, data: { deliveryRunId: null, runSequence: null } }),
      ...keep.map((oid, i) => prisma.order.update({ where: { id: oid }, data: { runSequence: i + 1 } })),
    ]);
    await auditStaff(ctx, { action: "delivery.stops_changed", targetType: "DeliveryRun", targetId: run.id, summary: `${run.name}: ${keep.length} stop(s)` });
    done(run.id);
    return { ok: true, data: undefined };
  });
}

export async function addStops(input: { runId: string; orderIds: string[] }): Promise<ActionResult> {
  return staffAction("delivery.manage_runs", async () => {
    const parsed = z.object({ runId: id, orderIds: z.array(id).min(1).max(80) }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Pick orders to add." };
    const run = await loadRun(parsed.data.runId);
    if (!run) return { ok: false, code: "INVALID", error: "That run doesn't exist." };
    if (run.status !== "PLANNING") return { ok: false, code: "CONFLICT", error: "The run has left. Make a new run for these." };
    let seq = run.orders.length;
    for (const oid of parsed.data.orderIds) {
      await prisma.order.updateMany({
        where: { id: oid, deliveryRunId: null, deliveryDate: { gte: run.day, lt: new Date(run.day.getTime() + DAY_MS) }, status: { in: ["CONFIRMED", "PICKING", "PACKED", "FAILED_DELIVERY"] } },
        data: { deliveryRunId: run.id, runSequence: ++seq },
      });
    }
    done(run.id);
    return { ok: true, data: undefined };
  });
}

export async function setRunRider(input: { runId: string; riderId: string | null }): Promise<ActionResult> {
  return staffAction("delivery.manage_runs", async (ctx) => {
    const run = await prisma.deliveryRun.findUnique({ where: { id: String(input.runId).slice(0, 40) } });
    if (!run) return { ok: false, code: "INVALID", error: "That run doesn't exist." };
    if (input.riderId && !(await prisma.rider.count({ where: { id: input.riderId, active: true } }))) return { ok: false, code: "INVALID", error: "That rider isn't available." };
    await prisma.deliveryRun.update({ where: { id: run.id }, data: { riderId: input.riderId } });
    await auditStaff(ctx, { action: "delivery.rider_assigned", targetType: "DeliveryRun", targetId: run.id, summary: run.name });
    done(run.id);
    return { ok: true, data: undefined };
  });
}

/** Sends the run out: every packed stop goes out for delivery. Stops not yet packed block it. */
export async function startRun(runId: string): Promise<ActionResult<{ out: number }>> {
  return staffAction("delivery.manage_runs", async (ctx) => {
    const run = await loadRun(String(runId).slice(0, 40));
    if (!run) return { ok: false, code: "INVALID", error: "That run doesn't exist." };
    if (run.status !== "PLANNING") return { ok: false, code: "CONFLICT", error: "This run has already left." };
    if (!run.riderId) return { ok: false, code: "INVALID", error: "Assign a rider first." };
    if (!run.orders.length) return { ok: false, code: "INVALID", error: "The run has no stops." };
    const unpacked = run.orders.filter((o) => o.status !== "PACKED" && o.status !== "FAILED_DELIVERY");
    if (unpacked.length) return { ok: false, code: "CONFLICT", error: `${unpacked.length} stop(s) aren't packed yet. Pack them or take them off the run.` };
    let out = 0;
    for (const o of run.orders) {
      const r = await changeOrderStatus(ctx, { orderId: o.id, to: "OUT_FOR_DELIVERY", version: o.version });
      if (!r.ok) return { ok: false, code: r.code, error: `Stopped at #${o.id.slice(-8).toUpperCase()}: ${r.error}` };
      out++;
    }
    await prisma.deliveryRun.update({ where: { id: run.id }, data: { status: "OUT", startedAt: new Date() } });
    await auditStaff(ctx, { action: "delivery.run_started", targetType: "DeliveryRun", targetId: run.id, summary: `${run.name}: ${out} stop(s) out` });
    done(run.id);
    return { ok: true, data: { out } };
  });
}

/** One stop's outcome. When every stop is settled, the run is done. */
export async function settleStop(input: { runId: string; orderId: string; version: number; delivered: boolean; note?: string }): Promise<ActionResult> {
  return staffAction(null, async (ctx) => {
    const parsed = z.object({ runId: id, orderId: id, version: z.number().int().min(0), delivered: z.boolean(), note: z.string().trim().max(300).optional() }).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That stop update isn't valid." };
    const { runId, orderId, version, delivered, note } = parsed.data;
    if (!delivered && !note) return { ok: false, code: "INVALID", error: "Say what happened (e.g. no one home, wrong address)." };
    const order = await prisma.order.findFirst({ where: { id: orderId, deliveryRunId: runId }, select: { id: true } });
    if (!order) return { ok: false, code: "INVALID", error: "That order isn't on this run." };
    const r = await changeOrderStatus(ctx, { orderId, to: delivered ? "DELIVERED" : "FAILED_DELIVERY", version, note });
    if (!r.ok) return r;
    const open = await prisma.order.count({ where: { deliveryRunId: runId, status: "OUT_FOR_DELIVERY" } });
    if (open === 0) await prisma.deliveryRun.updateMany({ where: { id: runId, status: "OUT" }, data: { status: "DONE", doneAt: new Date() } });
    done(runId);
    return { ok: true, data: undefined };
  });
}

export async function deleteRun(runId: string): Promise<ActionResult> {
  return staffAction("delivery.manage_runs", async (ctx) => {
    const run = await prisma.deliveryRun.findUnique({ where: { id: String(runId).slice(0, 40) } });
    if (!run) return { ok: false, code: "INVALID", error: "That run doesn't exist." };
    if (run.status !== "PLANNING") return { ok: false, code: "CONFLICT", error: "Only a run that hasn't left can be removed." };
    await prisma.$transaction([
      prisma.order.updateMany({ where: { deliveryRunId: run.id }, data: { deliveryRunId: null, runSequence: null } }),
      prisma.deliveryRun.delete({ where: { id: run.id } }),
    ]);
    await auditStaff(ctx, { action: "delivery.run_removed", targetType: "DeliveryRun", targetId: run.id, summary: run.name });
    done();
    return { ok: true, data: undefined };
  });
}

/* --------------------------------- riders --------------------------------- */

export async function saveRider(input: { id?: string; name: string; phone: string; notes: string; active: boolean }): Promise<ActionResult> {
  return staffAction("riders.manage", async (ctx) => {
    const parsed = z
      .object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().min(7).max(32), notes: z.string().trim().max(300).transform((v) => v || null), active: z.boolean() })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "A rider needs a name and a phone number." };
    const r = input.id ? await prisma.rider.update({ where: { id: String(input.id).slice(0, 40) }, data: parsed.data }) : await prisma.rider.create({ data: parsed.data });
    // By id: riders are people too, and the audit log can't be edited.
    await auditStaff(ctx, { action: input.id ? "riders.updated" : "riders.created", targetType: "Rider", targetId: r.id, summary: input.id ? "Rider updated" : "Rider added" });
    done();
    return { ok: true, data: undefined };
  });
}

/* ---------------------------------- zones --------------------------------- */

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(60),
  area: z.string().trim().min(2).max(200),
  isServed: z.boolean(),
  deliveryDays: z.array(z.enum(["MONDAY", "WEDNESDAY", "FRIDAY"])).max(3),
  deliveryFee: z.number().int().min(0).max(100_000),
  cutoffHour: z.number().int().min(0).max(23),
  sortOrder: z.number().int().min(0).max(1000),
});

export async function saveZone(input: { id: string } & z.input<typeof zoneSchema>): Promise<ActionResult> {
  return staffAction("zones.manage", async (ctx) => {
    const parsed = zoneSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "Check the fee (whole naira), cutoff hour (0 to 23) and days." };
    if (parsed.data.isServed && parsed.data.deliveryDays.length === 0) return { ok: false, code: "INVALID", error: "An area you deliver to needs at least one delivery day." };
    const before = await prisma.deliveryZone.findUnique({ where: { id: String(input.id).slice(0, 40) } });
    if (!before) return { ok: false, code: "INVALID", error: "That area doesn't exist." };
    await prisma.deliveryZone.update({ where: { id: before.id }, data: parsed.data });
    const diff = Object.fromEntries(
      (Object.keys(parsed.data) as (keyof typeof parsed.data)[])
        .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(parsed.data[k]))
        .map((k) => [k, [before[k], parsed.data[k]]]),
    );
    await auditStaff(ctx, { action: "zones.updated", targetType: "DeliveryZone", targetId: before.id, summary: `${before.name}: ${Object.keys(diff).join(", ") || "no changes"}`, diff });
    revalidatePath("/zones");
    // Checkout, the cart and sign-up read these.
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  });
}
