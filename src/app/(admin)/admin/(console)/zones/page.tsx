import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHeader } from "../../_ui/kit";
import { naira } from "../../_ui/format";
import { ZonesView } from "./zones-view";

export const metadata: Metadata = { title: "Delivery areas" };

export default async function ZonesPage() {
  const { staff } = await requireStaffPage("zones.view");
  const [zones, waitlist] = await Promise.all([
    prisma.deliveryZone.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { users: true, orders: true } } } }),
    prisma.waitlistSignup.groupBy({ by: ["zoneRequested"], where: { zoneRequested: { not: null } }, _count: { _all: true }, orderBy: { _count: { zoneRequested: "desc" } }, take: 8 }),
  ]);
  return (
    <>
      <PageHeader
        title="Delivery areas"
        description={`Where you deliver, on which days, what it costs and when orders close. Delivery is free above ${naira((await getSiteSettings()).delivery.freeThreshold)} and always on Member Plus.`}
      />
      <ZonesView
        canManage={can(staff.role as Role, "zones.manage")}
        zones={zones.map((z) => ({
          id: z.id, name: z.name, area: z.area, isServed: z.isServed, deliveryDays: z.deliveryDays, deliveryFee: z.deliveryFee, cutoffHour: z.cutoffHour, sortOrder: z.sortOrder,
          customers: z._count.users, orders: z._count.orders,
        }))}
        waitlist={waitlist.map((w) => ({ area: w.zoneRequested ?? "", count: w._count._all }))}
      />
    </>
  );
}
