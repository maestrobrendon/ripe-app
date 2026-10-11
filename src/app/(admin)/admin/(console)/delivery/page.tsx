import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { workDays } from "@/lib/admin/work-days";
import { STATUS_LABEL } from "@/lib/order-status";
import { Badge, Card, PageHeader } from "../../_ui/kit";
import { DayPicker } from "../../_ui/day-picker";
import { RunPlanner } from "./run-planner";

export const metadata: Metadata = { title: "Delivery" };

const RUN_LABEL = { PLANNING: "Planning", OUT: "Out", DONE: "Done" } as const;

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { staff } = await requireStaffPage("delivery.view");
  const role = staff.role as Role;
  const { days, current, range } = await workDays(["CONFIRMED", "PICKING", "PACKED", "OUT_FOR_DELIVERY", "FAILED_DELIVERY"], (await searchParams).day);

  const [runs, loose, riders] = await Promise.all([
    prisma.deliveryRun.findMany({
      where: { day: range },
      orderBy: { createdAt: "asc" },
      include: { rider: { select: { name: true } }, orders: { select: { status: true } } },
    }),
    prisma.order.findMany({
      where: { deliveryDate: range, deliveryRunId: null, status: { in: ["CONFIRMED", "PICKING", "PACKED", "FAILED_DELIVERY"] } },
      orderBy: [{ zoneName: "asc" }, { createdAt: "asc" }],
      select: { id: true, status: true, customerName: true, zoneName: true },
    }),
    prisma.rider.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Delivery" description="Group the day's orders into runs, give each a rider and an order of stops, then send it out." />
      <DayPicker base="/delivery" days={days} current={current} />

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card title={`Runs (${runs.length})`}>
          <ul className="divide-y divide-black/5">
            {runs.map((r) => {
              const done = r.orders.filter((o) => o.status === "DELIVERED" || o.status === "FAILED_DELIVERY").length;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                  <div>
                    <Link href={`/delivery/runs/${r.id}`} className="text-[14px] font-semibold hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-carbon/60">
                      {r.rider?.name ?? "No rider yet"} · {r.orders.length} stop{r.orders.length === 1 ? "" : "s"}
                      {r.status !== "PLANNING" && ` · ${done} settled`}
                    </p>
                  </div>
                  <Badge tone={r.status === "DONE" ? "good" : r.status === "OUT" ? "warn" : "neutral"}>{RUN_LABEL[r.status]}</Badge>
                </li>
              );
            })}
            {runs.length === 0 && <li className="py-3 text-[13px] text-carbon/50">No runs for this day yet.</li>}
          </ul>
        </Card>

        <RunPlanner
          day={current}
          canPlan={can(role, "delivery.manage_runs")}
          riders={riders}
          orders={loose.map((o) => ({ id: o.id, ref: `#${o.id.slice(-8).toUpperCase()}`, customer: o.customerName, zone: o.zoneName, status: STATUS_LABEL[o.status], packed: o.status === "PACKED" || o.status === "FAILED_DELIVERY" }))}
          defaultName={`Run ${runs.length + 1}`}
        />
      </div>
    </>
  );
}
