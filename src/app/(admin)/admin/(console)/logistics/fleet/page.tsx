import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { Card, PageHeader } from "../../../_ui/kit";
import { FleetRow } from "./fleet-row";

export const metadata: Metadata = { title: "Fleet" };

/** Who delivers: each rider's vehicle, how many stops fit, and the per-km rate agreed with them or their partner. */
export default async function FleetPage() {
  const { staff } = await requireStaffPage("delivery.view");
  const canEdit = can(staff.role as Role, "riders.manage");
  const riders = await prisma.rider.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, phone: true, active: true, vehicle: true, capacity: true, costPerKm: true, partner: true, _count: { select: { runs: true } } },
  });

  return (
    <>
      <PageHeader
        title="Fleet"
        description="Each rider or logistics partner, their vehicle, how many stops fit, and what you pay them per kilometre. The planner uses this to split the day and work out your margin."
        actions={
          <Link href="/delivery/riders" className="text-[13px] font-semibold text-carbon/60 hover:text-carbon">
            Add or remove riders →
          </Link>
        }
      />
      <Card>
        {riders.length === 0 ? (
          <p className="text-[13px] text-carbon/55">
            No riders yet. Add them under{" "}
            <Link href="/delivery/riders" className="font-semibold underline">
              Delivery → Riders
            </Link>
            , then set their vehicle and rate here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-carbon/50">
                  <th className="pb-2 font-medium">Rider</th>
                  <th className="pb-2 font-medium">Vehicle</th>
                  <th className="pb-2 font-medium">Stops per run</th>
                  <th className="pb-2 font-medium">Rate per km</th>
                  <th className="pb-2 font-medium">Partner</th>
                  <th className="pb-2 text-right font-medium">10 km costs</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <FleetRow key={r.id} rider={{ ...r, runs: r._count.runs }} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
