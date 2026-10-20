import "server-only";
import { prisma } from "@/lib/prisma";
import { angleFrom, arrivals, directionsLinks, planRoutes, routeThrough, travelTable } from "@/lib/logistics";
import { getLogistics, routingOptions, type LogisticsSettings } from "@/lib/delivery-logistics";

/*
 * Planning a delivery day: the day's unplanned orders, split across the
 * vehicles given and put in the fastest order, with road lines to draw, arrival
 * times, cost against what customers paid, and Google Maps links. Nothing is
 * saved here; Admin → Logistics saves a plan as delivery runs.
 */

const DAY_MS = 86_400_000;
const PLANNABLE = ["CONFIRMED", "PICKING", "PACKED", "FAILED_DELIVERY"] as const;

const minutes = (sec: number, s: LogisticsSettings) => (sec / 60) * s.trafficFactor;
function clock(start: string, addMin: number) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + Math.round(addMin);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export type PlanStop = {
  id: string;
  name: string;
  address: string;
  zone: string;
  lat: number;
  lng: number;
  approximate: boolean;
  fee: number;
  total: number;
  paid: boolean;
};
export type PlanRoute = {
  riderId: string | null;
  stops: PlanStop[];
  km: number;
  min: number;
  etas: string[];
  finish: string;
  line: [number, number][];
  /** What the rider or partner costs for this route, at their rate per km. */
  cost: number;
  /** What customers were charged for delivery on it. */
  charged: number;
  links: string[];
};
export type DayPlan = {
  routes: PlanRoute[];
  unassigned: PlanStop[];
  missing: { id: string; name: string; address: string }[];
  approximate: boolean;
};

export async function planForDay(day: Date, vehicles: { riderId: string | null; capacity: number }[], returnToDepot: boolean): Promise<DayPlan> {
  const s = await getLogistics();

  const orders = await prisma.order.findMany({
    where: {
      deliveryDate: { gte: day, lt: new Date(day.getTime() + DAY_MS) },
      deliveryRunId: null,
      status: { in: [...PLANNABLE] },
    },
    select: {
      id: true,
      customerName: true,
      address: true,
      zoneName: true,
      lat: true,
      lng: true,
      deliveryFee: true,
      total: true,
      paidAt: true,
      deliveryZone: { select: { centerLat: true, centerLng: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  // Where each stop is: its own point, else the middle of its area (marked approximate), else it needs finding.
  const stops: PlanStop[] = [];
  const missing: DayPlan["missing"] = [];
  for (const o of orders) {
    const own = o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null;
    const area = o.deliveryZone?.centerLat != null && o.deliveryZone.centerLng != null ? { lat: o.deliveryZone.centerLat, lng: o.deliveryZone.centerLng } : null;
    const at = own ?? area;
    if (!at) missing.push({ id: o.id, name: o.customerName, address: o.address });
    else
      stops.push({
        id: o.id,
        name: o.customerName,
        address: o.address,
        zone: o.zoneName ?? "",
        ...at,
        approximate: !own,
        fee: o.deliveryFee,
        total: o.total,
        paid: Boolean(o.paidAt),
      });
  }
  if (!stops.length) return { routes: [], unassigned: [], missing, approximate: false };

  const points = [s.depot, ...stops.map((st) => ({ lat: st.lat, lng: st.lng }))];
  const table = await travelTable(points, routingOptions());
  const plan = planRoutes({
    matrix: table,
    stops: stops.map((_, i) => i + 1),
    vehicles: vehicles.map((v) => ({ capacity: v.capacity })),
    returnToDepot,
    angles: points.map((p) => angleFrom(s.depot, p)),
  });

  const riders = await prisma.rider.findMany({
    where: {
      id: {
        in: vehicles.map((v) => v.riderId).filter((x): x is string => Boolean(x)),
      },
    },
    select: { id: true, costPerKm: true },
  });
  const routes: PlanRoute[] = await Promise.all(
    plan.routes.map(async (r, vi) => {
      const routeStops = r.stops.map((i) => stops[i - 1]);
      const pts = [s.depot, ...routeStops.map((st) => ({ lat: st.lat, lng: st.lng })), ...(returnToDepot ? [s.depot] : [])];
      const road = routeStops.length ? await routeThrough(pts, routingOptions()) : null;
      const eta = arrivals(
        {
          ...r,
          legs: r.legs.map((l) => ({ ...l, sec: l.sec * s.trafficFactor })),
        },
        s.serviceMin,
      );
      const km = road?.km ?? r.km;
      const totalMin = minutes(r.sec, s) + routeStops.length * s.serviceMin;
      const rider = riders.find((x) => x.id === vehicles[vi].riderId);
      return {
        riderId: vehicles[vi].riderId,
        stops: routeStops,
        km: Math.round(km * 10) / 10,
        min: Math.round(totalMin),
        etas: eta.map((m) => clock(s.startTime, m)),
        finish: clock(s.startTime, totalMin),
        line: road?.line ?? [],
        cost: Math.round(km * (rider?.costPerKm ?? 0)),
        charged: routeStops.reduce((t, st) => t + st.fee, 0),
        links: routeStops.length ? directionsLinks(pts) : [],
      };
    }),
  );
  return {
    routes,
    unassigned: plan.unassigned.map((i) => stops[i - 1]),
    missing,
    approximate: table.approximate,
  };
}
