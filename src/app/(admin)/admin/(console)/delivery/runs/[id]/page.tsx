import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { STATUS_LABEL } from "@/lib/order-status";
import { ymd } from "@/lib/delivery-dates";
import { PageHeader } from "../../../../_ui/kit";
import { dayDate, orderRef, when } from "../../../../_ui/format";
import { RunControls } from "./run-controls";

export const metadata: Metadata = { title: "Delivery run" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await requireStaffPage("delivery.view");
  const role = staff.role as Role;
  const { id } = await params;
  const run = await prisma.deliveryRun.findUnique({
    where: { id: id.slice(0, 40) },
    include: {
      rider: { select: { id: true, name: true } },
      orders: { orderBy: { runSequence: "asc" }, select: { id: true, status: true, version: true, customerName: true, zoneName: true, address: true } },
    },
  });
  if (!run) notFound();
  const riders = await prisma.rider.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <>
      <Link href={`/delivery?day=${ymd(run.day)}`} className="text-[13px] font-semibold text-carbon/60 underline underline-offset-2">
        ← {dayDate(run.day)}
      </Link>
      <PageHeader
        title={run.name}
        description={
          <>
            {dayDate(run.day)} · {run.orders.length} stop{run.orders.length === 1 ? "" : "s"}
            {run.startedAt && ` · left ${when(run.startedAt)}`}
            {run.doneAt && ` · finished ${when(run.doneAt)}`}
          </>
        }
        actions={
          <Link href={`/delivery/runs/${run.id}/manifest`} className="text-[13px] font-semibold underline underline-offset-2">
            Rider sheet
          </Link>
        }
      />
      <RunControls
        run={{ id: run.id, status: run.status, riderId: run.rider?.id ?? null }}
        riders={riders}
        stops={run.orders.map((o) => ({ id: o.id, ref: orderRef(o.id), version: o.version, status: o.status, statusLabel: STATUS_LABEL[o.status], customer: o.customerName, zone: o.zoneName, address: o.address }))}
        canPlan={can(role, "delivery.manage_runs")}
        canSettle={can(role, "delivery.update_status") || can(role, "orders.update_status")}
      />
    </>
  );
}
