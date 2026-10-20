"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffAction, auditStaff, type ActionResult } from "@/lib/admin/guard";
import { parseYmd } from "@/lib/delivery-dates";
import { geocode, routeThrough, type LatLng } from "@/lib/logistics";
import { planForDay } from "@/lib/logistics-plan";
import {
  LOGISTICS_KEY,
  geocodeOptions,
  getLogistics,
  locateFromText,
  logisticsSchema,
  priceFor,
  routingOptions,
  zoneDistances,
} from "@/lib/delivery-logistics";

/*
 * Logistics: distance pricing, the delivery calculator, and planning each
 * day's routes. Viewing needs delivery.view; planning and saving runs needs
 * delivery.manage_runs; pricing needs zones.manage; vehicles and partner
 * rates need riders.manage.
 */

const DAY_MS = 86_400_000;
const id = z.string().min(1).max(40);
const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const PLANNABLE = ["CONFIRMED", "PICKING", "PACKED", "FAILED_DELIVERY"] as const;


/* -------------------------------- pricing -------------------------------- */

export async function saveLogisticsSettings(input: z.input<typeof logisticsSchema>): Promise<ActionResult<{ zones: number }>> {
  return staffAction("zones.manage", async (ctx) => {
    const parsed = logisticsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: parsed.error.issues[0]?.message ?? "Check the numbers." };
    const s = parsed.data;
    if (s.rules.maxFee > 0 && s.rules.maxFee < s.rules.minFee) return { ok: false, code: "INVALID", error: "The maximum fee can't be below the minimum." };
    // Each area's road distance from the depot, so area prices are ready before anyone gives an address.
    const value = { ...s, zoneKm: await zoneDistances(s) };
    await prisma.siteSetting.upsert({ where: { key: LOGISTICS_KEY }, create: { key: LOGISTICS_KEY, value, updatedById: ctx.staff.id }, update: { value, updatedById: ctx.staff.id } });
    await auditStaff(ctx, { action: "logistics.settings_saved", targetType: "SiteSetting", targetId: LOGISTICS_KEY, summary: `${s.enabled ? "Distance pricing on" : "Distance pricing off"}: ₦${s.rules.baseFee} + ₦${s.rules.perKm}/km` });
    revalidatePath("/logistics", "layout");
    return { ok: true, data: { zones: Object.keys(value.zoneKm).length } };
  });
}

/** Places matching what was typed, for the depot and the calculator. */
export async function searchPlaces(query: string): Promise<ActionResult<{ label: string; lat: number; lng: number }[]>> {
  return staffAction("delivery.view", async () => {
    const q = z.string().trim().min(3).max(160).safeParse(query);
    if (!q.success) return { ok: true, data: [] };
    return { ok: true, data: await geocode(q.data, geocodeOptions) };
  });
}

/* ------------------------------- calculator ------------------------------ */

export type Quote = {
  to: LatLng;
  km: number;
  min: number;
  line: [number, number][];
  approximate: boolean;
  breakdown: ReturnType<typeof priceFor>;
  /** What the same rules give at a few other distances, for a sense of scale. */
  scale: { km: number; fee: number }[];
};

/** Distance, time and fee from the depot to a point, with the road to draw. */
export async function quotePoint(p: LatLng, draft?: z.input<typeof logisticsSchema>): Promise<ActionResult<Quote>> {
  return staffAction("delivery.view", async () => {
    const at = point.safeParse(p);
    if (!at.success) return { ok: false, code: "INVALID", error: "Pick a point on the map." };
    // The pricing page previews unsaved numbers; the calculator uses the saved ones.
    const s = draft ? (logisticsSchema.safeParse(draft).data ?? (await getLogistics())) : await getLogistics();
    const r = await routeThrough([s.depot, at.data], routingOptions());
    const breakdown = priceFor(r.km, s);
    return {
      ok: true,
      data: { to: at.data, km: r.km, min: r.min * s.trafficFactor, line: r.line, approximate: r.approximate, breakdown, scale: [2, 5, 10, 15, 20, 30].map((km) => ({ km, fee: priceFor(km, s).fee })) },
    };
  });
}

/* -------------------------------- planner -------------------------------- */

import type { DayPlan } from "@/lib/logistics-plan";
export type { DayPlan, PlanRoute, PlanStop } from "@/lib/logistics-plan";

const vehicleInput = z.object({ riderId: id.nullable(), capacity: z.number().int().min(1).max(200) });

/** The best routes for a day's unplanned orders, across the vehicles given. Nothing is saved. */
export async function planDay(input: { day: string; vehicles: { riderId: string | null; capacity: number }[]; returnToDepot: boolean }): Promise<ActionResult<DayPlan>> {
  return staffAction("delivery.view", async () => {
    const parsed = z.object({ day: z.string(), vehicles: z.array(vehicleInput).min(1).max(12), returnToDepot: z.boolean() }).safeParse(input);
    const day = parsed.success ? parseYmd(parsed.data.day) : null;
    if (!parsed.success || !day) return { ok: false, code: "INVALID", error: "Pick a day and at least one vehicle." };
    return { ok: true, data: await planForDay(day, parsed.data.vehicles, parsed.data.returnToDepot) };
  });
}

/** Save a plan as delivery runs, one per vehicle, with stops in the planned order. */
export async function savePlan(input: { day: string; routes: { riderId: string | null; name: string; orderIds: string[]; km: number; min: number; line: [number, number][] }[] }): Promise<ActionResult<{ runs: number }>> {
  return staffAction("delivery.manage_runs", async (ctx) => {
    const parsed = z
      .object({
        day: z.string(),
        routes: z.array(z.object({ riderId: id.nullable(), name: z.string().trim().min(2).max(60), orderIds: z.array(id).min(1).max(80), km: z.number().min(0).max(2000), min: z.number().min(0).max(2000), line: z.array(z.tuple([z.number(), z.number()])).max(20_000) })).min(1).max(12),
      })
      .safeParse(input);
    const day = parsed.success ? parseYmd(parsed.data.day) : null;
    if (!parsed.success || !day) return { ok: false, code: "INVALID", error: "That plan isn't valid. Plan again." };

    const made = await prisma.$transaction(async (tx) => {
      let runs = 0;
      for (const r of parsed.data.routes) {
        // Only orders still unplanned for that day.
        const eligible = await tx.order.findMany({ where: { id: { in: r.orderIds }, deliveryRunId: null, deliveryDate: { gte: day, lt: new Date(day.getTime() + DAY_MS) }, status: { in: [...PLANNABLE] } }, select: { id: true } });
        const order = r.orderIds.filter((o) => eligible.some((e) => e.id === o));
        if (!order.length) continue;
        const run = await tx.deliveryRun.create({ data: { day, name: r.name, riderId: r.riderId, distanceKm: r.km, durationMin: Math.round(r.min), geometry: r.line } });
        for (const [i, oid] of order.entries()) await tx.order.update({ where: { id: oid }, data: { deliveryRunId: run.id, runSequence: i + 1 } });
        runs++;
      }
      return runs;
    });
    await auditStaff(ctx, { action: "logistics.plan_saved", targetType: "DeliveryRun", summary: `${made} run(s) for ${parsed.data.day}` });
    revalidatePath("/logistics", "layout");
    revalidatePath("/delivery", "layout");
    return { ok: true, data: { runs: made } };
  });
}

/** Find orders on the map from their address text (approximate; staff can drag them right). */
export async function locateOrders(dayStr: string): Promise<ActionResult<{ found: number; left: number }>> {
  return staffAction("delivery.manage_runs", async () => {
    const day = parseYmd(dayStr);
    if (!day) return { ok: false, code: "INVALID", error: "Pick a day." };
    const todo = await prisma.order.findMany({
      where: { deliveryDate: { gte: day, lt: new Date(day.getTime() + DAY_MS) }, lat: null, status: { in: [...PLANNABLE] } },
      select: { id: true, address: true, landmark: true, zoneName: true },
      take: 12, // Nominatim allows one lookup a second.
    });
    let found = 0;
    for (const o of todo) {
      const p = await locateFromText([o.address, o.landmark].filter(Boolean).join(", "), o.zoneName ?? "");
      if (p) {
        await prisma.order.update({ where: { id: o.id }, data: { lat: p.lat, lng: p.lng, geoSource: "GEOCODE" } });
        found++;
      }
    }
    const left = await prisma.order.count({ where: { deliveryDate: { gte: day, lt: new Date(day.getTime() + DAY_MS) }, lat: null, status: { in: [...PLANNABLE] } } });
    revalidatePath("/logistics");
    return { ok: true, data: { found, left } };
  });
}

/** Staff put a stop exactly where it is (dragged on the map). */
export async function moveStop(input: { orderId: string; lat: number; lng: number }): Promise<ActionResult> {
  return staffAction("delivery.manage_runs", async (ctx) => {
    const parsed = z.object({ orderId: id }).merge(point).safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: "That point isn't valid." };
    await prisma.order.update({ where: { id: parsed.data.orderId }, data: { lat: parsed.data.lat, lng: parsed.data.lng, geoSource: "STAFF" } });
    await auditStaff(ctx, { action: "logistics.stop_moved", targetType: "Order", targetId: parsed.data.orderId });
    return { ok: true, data: undefined };
  });
}

/* --------------------------------- fleet --------------------------------- */

export async function saveFleet(input: { riderId: string; vehicle: string; capacity: number; costPerKm: number; partner: string }): Promise<ActionResult> {
  return staffAction("riders.manage", async (ctx) => {
    const parsed = z
      .object({ riderId: id, vehicle: z.enum(["BIKE", "CAR", "VAN"]), capacity: z.number().int().min(1).max(200), costPerKm: z.number().int().min(0).max(10_000), partner: z.string().trim().max(60) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, code: "INVALID", error: parsed.error.issues[0]?.message ?? "Check the numbers." };
    const { riderId, partner, ...rest } = parsed.data;
    await prisma.rider.update({ where: { id: riderId }, data: { ...rest, partner: partner || null } });
    await auditStaff(ctx, { action: "logistics.fleet_saved", targetType: "Rider", targetId: riderId, summary: `${rest.vehicle}, ${rest.capacity} stops, ₦${rest.costPerKm}/km` });
    revalidatePath("/logistics/fleet");
    return { ok: true, data: undefined };
  });
}
