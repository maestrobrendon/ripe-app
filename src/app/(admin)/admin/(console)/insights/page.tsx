import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/admin/guard";
import { dailySales, memberStats, salesBreakdown, topProducts, wasteByProduct } from "@/lib/admin/insights";
import { formatQty } from "@/lib/stock-core";
import { Card, PageHeader, cx } from "../../_ui/kit";
import { BarList, ColumnChart, Stat } from "../../_ui/charts";
import { naira, one } from "../../_ui/format";

export const metadata: Metadata = { title: "Insights" };

const RANGES = [7, 30, 90] as const;
const short = (ymd: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("insights.view");
  const asked = Number(one((await searchParams).days, 3));
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;
  const [series, sales, members, products, waste] = await Promise.all([dailySales(days), salesBreakdown(days), memberStats(days), topProducts(days), wasteByProduct(days)]);

  return (
    <>
      <PageHeader
        title="Insights"
        description="How the business is doing. Paid orders only, cancellations and refunds excluded. No customer details on this page."
        actions={
          <nav className="flex gap-1" aria-label="Period">
            {RANGES.map((r) => (
              <Link key={r} href={`/insights?days=${r}`} aria-current={r === days ? "page" : undefined} className={cx("h-9 rounded-lg px-3 text-[13px] leading-9 font-semibold", r === days ? "bg-carbon text-paper-white" : "hover:bg-soft-mist/70")}>
                {r} days
              </Link>
            ))}
          </nav>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={naira(sales.revenue)} note={`${naira(sales.deliveryFees)} of it delivery fees`} />
        <Stat label="Orders" value={sales.orders.toLocaleString("en-NG")} note={`${sales.cancelled} cancelled`} />
        <Stat label="Average order" value={naira(sales.averageOrder)} />
        <Stat label="Refunded" value={naira(sales.refunds.amount)} note={`${sales.refunds.count} refund${sales.refunds.count === 1 ? "" : "s"}`} />
        <Stat label="Members" value={members.members.toLocaleString("en-NG")} note={`${naira(members.monthlyRevenue)} a month in plans`} />
        <Stat label="Joined a plan" value={String(members.joined)} note={`${members.cancelled} left · ${members.pending} waiting for payment`} />
        <Stat label="New customers" value={String(members.newCustomers)} note={`${members.customers.toLocaleString("en-NG")} in all`} />
        <Stat
          label="Missed deliveries"
          value={`${Math.round(sales.deliveries.failRate * 100)}%`}
          note={`${sales.deliveries.failed} of ${sales.deliveries.delivered + sales.deliveries.failed} delivery attempts`}
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="Orders per day">
          <ColumnChart label="Orders per day" points={series.map((p) => ({ key: p.day, value: p.orders, title: short(p.day) }))} />
        </Card>
        <Card title="Revenue per day">
          <ColumnChart label="Revenue per day" format={naira} points={series.map((p) => ({ key: p.day, value: p.revenue, title: short(p.day) }))} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Best sellers">
          <BarList format={naira} rows={products.map((p) => ({ label: p.name, value: p.revenue, note: formatQty(p.stock, p.soldAs) }))} empty="No paid orders in this period." />
        </Card>
        <Card title="By area">
          <BarList format={naira} rows={sales.byZone.map((z) => ({ label: z.label, value: z.revenue, note: `${z.orders}` }))} empty="No paid orders in this period." />
          <div className="mt-5 border-t border-black/6 pt-4">
            <BarList format={naira} rows={sales.byType.map((t) => ({ label: t.label, value: t.revenue, note: `${t.orders}` }))} />
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Members by plan">
            <BarList rows={members.byTier.map((t) => ({ label: t.label, value: t.members, note: naira(t.monthly) }))} />
          </Card>
          <Card title="Most wasted">
            <BarList rows={waste.map((w) => ({ label: w.name, value: w.entries, note: formatQty(w.quantity, w.soldAs) }))} empty="No waste recorded in this period." />
          </Card>
        </div>
      </div>
    </>
  );
}
