"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, type ActionResult } from "@/lib/admin/guard";
import { changeOrderStatus } from "@/lib/admin/order-ops";
import { parseYmd } from "@/lib/delivery-dates";
import type { OrderStatus } from "@/generated/prisma/enums";

/*
 * Fulfilment: moving a day's orders through confirm, pick and pack. Every
 * move goes through changeOrderStatus, so the role check, stock, timeline,
 * audit and customer emails are the same as on the order page.
 */

const DAY_MS = 86_400_000;

function done(orderId?: string) {
  revalidatePath("/fulfilment", "layout");
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

/** Moves every order for a day from one status to the next. Reports what didn't move and why. */
export async function advanceDay(input: { day: string; from: "RECEIVED" | "CONFIRMED"; to: "CONFIRMED" | "PICKING" }): Promise<ActionResult<{ moved: number; failed: string[] }>> {
  return staffAction(null, async (ctx) => {
    const parsed = z.object({ day: z.string(), from: z.enum(["RECEIVED", "CONFIRMED"]), to: z.enum(["CONFIRMED", "PICKING"]) }).safeParse(input);
    const day = parsed.success ? parseYmd(parsed.data.day) : null;
    if (!parsed.success || !day) return { ok: false, code: "INVALID", error: "Pick a day." };
    const orders = await prisma.order.findMany({
      where: { status: parsed.data.from, deliveryDate: { gte: day, lt: new Date(day.getTime() + DAY_MS) } },
      select: { id: true, version: true },
      take: 300,
    });
    let moved = 0;
    const failed: string[] = [];
    for (const o of orders) {
      const r = await changeOrderStatus(ctx, { orderId: o.id, to: parsed.data.to as OrderStatus, version: o.version });
      if (r.ok) moved++;
      else {
        failed.push(`#${o.id.slice(-8).toUpperCase()}: ${r.error}`);
        // A role problem applies to every order; stop rather than repeat it 100 times.
        if (r.code === "FORBIDDEN") break;
      }
    }
    done();
    return { ok: true, data: { moved, failed } };
  });
}

/**
 * Finishes packing one order. Starts picking first if it hadn't been. Items
 * marked short go on the timeline so support can refund or follow up.
 */
export async function packOrder(input: { orderId: string; version: number; short: { name: string; note: string }[] }): Promise<ActionResult> {
  return staffAction(null, async (ctx) => {
    const parsed = z
      .object({ orderId: z.string().max(40), version: z.number().int().min(0), short: z.array(z.object({ name: z.string().max(120), note: z.string().trim().max(200) })).max(100) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That packing record isn't valid." };
    const { orderId, short } = parsed.data;
    let version = parsed.data.version;

    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, version: true } });
    if (!order) return { ok: false, code: "INVALID", error: "That order doesn't exist." };
    if (order.status === "CONFIRMED") {
      const r = await changeOrderStatus(ctx, { orderId, to: "PICKING", version });
      if (!r.ok) return r;
      version += 1;
    }
    const note = short.length ? `Packed short: ${short.map((s) => (s.note ? `${s.name} (${s.note})` : s.name)).join(", ")}` : null;
    const r = await changeOrderStatus(ctx, { orderId, to: "PACKED", version, note });
    if (!r.ok) return r;
    done(orderId);
    return { ok: true, data: undefined };
  });
}

/** Starts packing a single order (CONFIRMED → PICKING) from the pack screen. */
export async function startPicking(input: { orderId: string; version: number }): Promise<ActionResult> {
  return staffAction(null, async (ctx) => {
    const r = await changeOrderStatus(ctx, { orderId: String(input.orderId).slice(0, 40), to: "PICKING", version: Number(input.version) });
    if (r.ok) done(input.orderId);
    return r;
  });
}
