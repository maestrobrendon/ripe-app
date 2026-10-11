import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { PageHeader } from "../../../_ui/kit";
import { RidersView } from "./riders-view";

export const metadata: Metadata = { title: "Riders" };

export default async function RidersPage() {
  const { staff } = await requireStaffPage("delivery.view");
  const riders = await prisma.rider.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { runs: true } } } });
  return (
    <>
      <PageHeader title="Riders" description="The people who carry runs. Their phone shows on the rider sheet so stops can reach them." />
      <RidersView
        canManage={can(staff.role as Role, "riders.manage")}
        riders={riders.map((r) => ({ id: r.id, name: r.name, phone: r.phone, notes: r.notes ?? "", active: r.active, runs: r._count.runs }))}
      />
    </>
  );
}
