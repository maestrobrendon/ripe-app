import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { OFFERED } from "@/lib/product";
import { formatNaira } from "@/lib/format";
import { Card, PageHeader } from "../_ui/kit";

export const metadata: Metadata = { title: "Overview" };

/** Lagos midnight today, as a UTC instant (Lagos is UTC+1 all year). */
function lagosToday(): Date {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 60 * 60 * 1000);
}

export default async function OverviewPage() {
  const { staff } = await requireStaffPage("dashboard.view");
  const today = lagosToday();

  // Aggregates only: nothing here identifies a customer, so every role with
  // dashboard access (including Analyst) can see it.
  const [ordersToday, revenueToday, openOrders, customers, members, offered, waitlist, staffActive] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.aggregate({ where: { createdAt: { gte: today }, paidAt: { not: null } }, _sum: { total: true } }),
    prisma.order.count({ where: { status: { not: "DELIVERED" } } }),
    prisma.user.count(),
    prisma.user.count({ where: { subscriptionTierId: { not: null } } }),
    prisma.product.count({ where: OFFERED }),
    prisma.waitlistSignup.count(),
    prisma.staffUser.count({ where: { status: "ACTIVE" } }),
  ]);

  const stats: { label: string; value: string; note: string }[] = [
    { label: "Orders today", value: String(ordersToday), note: "Since midnight, Lagos time" },
    { label: "Paid today", value: formatNaira(revenueToday._sum.total ?? 0), note: "Test-mode payments until a gateway is live" },
    { label: "Open orders", value: String(openOrders), note: "Not yet delivered. Managed in Orders (Phase 2)" },
    { label: "Customers", value: String(customers), note: "All accounts" },
    { label: "Members", value: String(members), note: "On Member or Member Plus" },
    { label: "Products on sale", value: String(offered), note: "Excludes discontinued lines" },
    { label: "Waitlist", value: String(waitlist), note: "Asked for an area we don't serve yet" },
    { label: "Active staff", value: String(staffActive), note: "Signed up with a second factor" },
  ];

  return (
    <>
      <PageHeader title={`Good to see you, ${staff.name.split(/\s+/)[0]}`} description="Today across Basket at a glance." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4!">
            <p className="text-[12px] font-semibold text-carbon/55">{s.label}</p>
            <p className="mt-1 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{s.value}</p>
            <p className="mt-1 text-[12px] text-carbon/45">{s.note}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
