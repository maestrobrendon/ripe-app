import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { OPEN_STATUSES, ORDER_STATUSES, STATUS_LABEL } from "@/lib/order-status";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { Badge, Button, Card, Input, PageHeader, cx } from "../../_ui/kit";
import { dayDate, lagosDayStart, naira, one, orderRef, statusTone, when } from "../../_ui/format";

export const metadata: Metadata = { title: "Orders" };

const PAGE = 50;
const selectClass = "h-11 rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("orders.view");
  const sp = await searchParams;
  const view = one(sp.status) ?? "open";
  const q = one(sp.q, 80);
  const day = one(sp.day, 10);
  const zone = one(sp.zone, 60);
  const after = one(sp.after, 40);
  const customer = one(sp.customer, 40);

  const statusWhere: Prisma.OrderWhereInput =
    view === "open" ? { status: { in: OPEN_STATUSES } } : (ORDER_STATUSES as readonly string[]).includes(view) ? { status: view as OrderStatus } : {};
  const dayStart = day ? lagosDayStart(day) : null;
  const digits = q?.replace(/\D/g, "") ?? "";
  const where: Prisma.OrderWhereInput = {
    ...statusWhere,
    ...(dayStart && { deliveryDate: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } }),
    ...(zone && { zoneName: zone }),
    ...(customer && { userId: customer }),
    ...(q && {
      OR: [
        { id: { endsWith: q.replace(/^#/, "").toLowerCase() } },
        { customerName: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ customerPhone: { contains: digits } }] : []),
        ...(q.includes("@") ? [{ customerEmail: { equals: q.toLowerCase() } }] : []),
      ],
    }),
  };

  const [orders, counts, zones] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(after && { cursor: { id: after }, skip: 1 }),
      select: { id: true, createdAt: true, customerName: true, zoneName: true, deliveryDate: true, total: true, paidAt: true, status: true, orderType: true, _count: { select: { items: true } } },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.deliveryZone.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);
  const more = orders.length > PAGE;
  const page = orders.slice(0, PAGE);
  const count = new Map(counts.map((c) => [c.status, c._count._all]));
  const openCount = OPEN_STATUSES.reduce((s, st) => s + (count.get(st) ?? 0), 0);

  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: view, q, day, zone, customer, ...extra })) if (v) p.set(k, v);
    return `/orders?${p}`;
  };
  const tabs: { key: string; label: string; n?: number }[] = [
    { key: "open", label: "Open", n: openCount },
    ...ORDER_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], n: count.get(s) ?? 0 })),
    { key: "all", label: "All" },
  ];

  return (
    <>
      <PageHeader title="Orders" description="Every order, newest first. Open means not yet delivered, cancelled or refunded." />

      <nav aria-label="Order status" className="-mx-1 mb-4 flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ status: t.key, after: undefined })}
            aria-current={view === t.key ? "page" : undefined}
            className={cx(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold",
              view === t.key ? "bg-carbon text-paper-white" : "text-carbon/65 hover:bg-soft-mist/70",
            )}
          >
            {t.label}
            {t.n !== undefined && <span className={cx("tabular-nums", view === t.key ? "text-paper-white/60" : "text-carbon/40")}>{t.n}</span>}
          </Link>
        ))}
      </nav>

      <Card className="mb-4">
        <form action="/orders" className="grid gap-3 sm:grid-cols-[1fr_170px_200px_auto] sm:items-center">
          <input type="hidden" name="status" value={view} />
          {customer && <input type="hidden" name="customer" value={customer} />}
          <Input name="q" placeholder="Order ref, customer name, phone or email" defaultValue={q} aria-label="Search orders" />
          <Input name="day" type="date" defaultValue={day} aria-label="Delivery day" />
          <select name="zone" defaultValue={zone ?? ""} aria-label="Delivery area" className={selectClass}>
            <option value="">All areas</option>
            {zones.map((z) => (
              <option key={z.name} value={z.name}>
                {z.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
      </Card>

      <Card className="p-0! overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Order</th>
                <th className="px-3 py-2.5 font-semibold">Customer</th>
                <th className="px-3 py-2.5 font-semibold">Delivery</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {page.map((o) => (
                <tr key={o.id} className="hover:bg-soft-mist/30">
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="font-mono font-semibold hover:underline">
                      {orderRef(o.id)}
                    </Link>
                    <span className="block text-[12px] text-carbon/50">
                      {when(o.createdAt)} · {o.orderType === "ONE_OFF" ? "Cart" : "Basket"}, {o._count.items} item{o._count.items === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-medium">{o.customerName}</td>
                  <td className="px-3 py-3">
                    {dayDate(o.deliveryDate)}
                    <span className="block text-[12px] text-carbon/50">{o.zoneName}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {naira(o.total)}
                    <span className="block text-[12px] text-carbon/50">{o.paidAt ? "Paid" : "Unpaid"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>
                  </td>
                </tr>
              ))}
              {page.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-carbon/50">
                    No orders match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 flex justify-between text-[13px] font-semibold">
        {after ? (
          <Link href={href({ after: undefined })} className="underline underline-offset-2">
            Newest
          </Link>
        ) : (
          <span />
        )}
        {more && (
          <Link href={href({ after: page[page.length - 1].id })} className="underline underline-offset-2">
            Older
          </Link>
        )}
      </div>
    </>
  );
}
