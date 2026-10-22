import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { workDays } from "@/lib/admin/work-days";
import { getLogistics } from "@/lib/delivery-logistics";
import { Badge, Card, PageHeader } from "../../_ui/kit";
import { DayPicker } from "../../_ui/day-picker";
import { naira } from "../../_ui/format";
import { DayPlanner } from "./day-planner";

export const metadata: Metadata = { title: "Logistics" };

const PLANNABLE = ["CONFIRMED", "PICKING", "PACKED", "FAILED_DELIVERY"] as const;

/**
 * Every order for a day on one map, and the best way to get them all out:
 * which vehicle takes which stops, in what order, how long it takes, and
 * what it costs against what customers paid for delivery.
 */
export default async function LogisticsPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { staff } = await requireStaffPage("delivery.view");
  const role = staff.role as Role;
  const { days, current, range } = await workDays([...PLANNABLE, "OUT_FOR_DELIVERY"], (await searchParams).day);

  const [settings, orders, runs, riders] = await Promise.all([
    getLogistics(),
    prisma.order.findMany({
      where: { deliveryDate: range, deliveryRunId: null, status: { in: [...PLANNABLE] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, customerName: true, address: true, zoneName: true, lat: true, lng: true, geoSource: true, deliveryFee: true, deliveryZone: { select: { centerLat: true, centerLng: true } } },
    }),
    prisma.deliveryRun.findMany({
      where: { day: range },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, distanceKm: true, durationMin: true, geometry: true, rider: { select: { name: true } }, _count: { select: { orders: true } } },
    }),
    prisma.rider.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, vehicle: true, capacity: true, costPerKm: true, partner: true } }),
  ]);

  const stops = orders.map((o) => {
    const own = o.lat != null && o.lng != null;
    const area = o.deliveryZone?.centerLat != null && o.deliveryZone.centerLng != null;
    return {
      id: o.id,
      name: o.customerName,
      address: o.address,
      zone: o.zoneName ?? "",
      fee: o.deliveryFee,
      lat: own ? o.lat! : area ? o.deliveryZone!.centerLat! : null,
      lng: own ? o.lng! : area ? o.deliveryZone!.centerLng! : null,
      // PIN (customer) and STAFF (dragged) are exact; GEOCODE is a text match; the area middle is a guess.
      precision: own ? (o.geoSource === "GEOCODE" ? "found" : "exact") : area ? "area" : "none",
    } as const;
  });

  return (
    <>
      <PageHeader
        title="Logistics"
        description="Every order for the day on the map, and the fastest way to get them out: who takes which stops, in what order, and what it costs."
        actions={
          <Link href="/logistics/pricing" className="text-[13px] font-semibold text-carbon/60 hover:text-carbon">
            {settings.enabled ? `Distance pricing on · ${naira(settings.rules.perKm)}/km` : "Distance pricing off"} →
          </Link>
        }
      />
      <DayPicker base="/logistics" days={days} current={current} />

      <DayPlanner
        key={current}
        day={current}
        depot={settings.depot}
        startTime={settings.startTime}
        trafficFactor={settings.trafficFactor}
        returnToDepot={settings.returnToDepot}
        canPlan={can(role, "delivery.manage_runs")}
        canMoveDepot={can(role, "zones.manage")}
        stops={stops}
        riders={riders}
      />

      {runs.length > 0 && (
        <Card title={`Already on runs (${runs.length})`} className="mt-5">
          <ul className="divide-y divide-black/5">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                <div>
                  <Link href={`/delivery/runs/${r.id}`} className="text-[14px] font-semibold hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-carbon/60">
                    {r.rider?.name ?? "No rider yet"} · {r._count.orders} stop{r._count.orders === 1 ? "" : "s"}
                    {r.distanceKm != null && ` · ${r.distanceKm.toFixed(1)} km`}
                    {r.durationMin != null && ` · about ${r.durationMin} min`}
                  </p>
                </div>
                <Badge tone={r.geometry ? "good" : "neutral"}>{r.geometry ? "Planned route" : "By hand"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
