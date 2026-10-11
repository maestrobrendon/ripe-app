import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { formatQty } from "@/lib/stock-core";
import type { Prisma, StockMovementKind } from "@/generated/prisma/client";
import { Badge, Button, Card, Input, PageHeader } from "../../../_ui/kit";
import { daysAgo, one, orderRef, when } from "../../../_ui/format";

export const metadata: Metadata = { title: "Stock history" };

const PAGE = 60;
const KIND_LABEL: Record<StockMovementKind, string> = { RECEIVE: "Received", SALE: "Packed", RETURN: "Returned", WASTE: "Waste", ADJUST: "Adjusted", COUNT: "Count" };
const selectClass = "h-11 rounded-xl bg-paper-white px-3 text-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)] outline-none";

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { staff } = await requireStaffPage("inventory.view");
  const sp = await searchParams;
  const q = one(sp.q, 60);
  const kind = one(sp.kind, 10);
  const after = one(sp.after, 40);
  const where: Prisma.StockMovementWhereInput = {
    ...(kind && kind in KIND_LABEL && { kind: kind as StockMovementKind }),
    ...(q && { product: { name: { contains: q, mode: "insensitive" } } }),
  };
  const [moves, wasteWeek] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(after && { cursor: { id: after }, skip: 1 }),
      include: { product: { select: { name: true, soldAs: true, costPrice: true } } },
    }),
    prisma.stockMovement.count({ where: { kind: "WASTE", at: { gte: daysAgo(7) } } }),
  ]);
  const more = moves.length > PAGE;
  const page = moves.slice(0, PAGE);
  const canOrders = can(staff.role as Role, "orders.view");
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, kind, ...extra })) if (v) p.set(k, v);
    return `/inventory/movements?${p}`;
  };

  return (
    <>
      <PageHeader title="Stock history" description={`Every change to stock, newest first. ${wasteWeek} waste entr${wasteWeek === 1 ? "y" : "ies"} in the last 7 days.`} />
      <Card className="mb-4">
        <form action="/inventory/movements" className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-center">
          <Input name="q" placeholder="Product name" defaultValue={q} aria-label="Product" />
          <select name="kind" defaultValue={kind ?? ""} aria-label="Kind" className={selectClass}>
            <option value="">Every kind</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Button size="sm">Filter</Button>
        </form>
      </Card>
      <Card className="p-0! overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
              <tr>
                <th className="px-5 py-2.5 font-semibold">When</th>
                <th className="px-3 py-2.5 font-semibold">Product</th>
                <th className="px-3 py-2.5 font-semibold">What</th>
                <th className="px-3 py-2.5 text-right font-semibold">Change</th>
                <th className="px-3 py-2.5 text-right font-semibold">Then</th>
                <th className="px-5 py-2.5 font-semibold">By, and why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {page.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-carbon/65">{when(m.at)}</td>
                  <td className="px-3 py-2.5 font-medium">{m.product.name}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={m.kind === "WASTE" ? "bad" : m.kind === "RECEIVE" || m.kind === "RETURN" ? "good" : "neutral"}>{KIND_LABEL[m.kind]}</Badge>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${m.quantity < 0 ? "text-[#9a2c00]" : ""}`}>
                    {m.quantity > 0 ? "+" : ""}
                    {formatQty(m.quantity, m.product.soldAs)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-carbon/60">{formatQty(m.balanceAfter, m.product.soldAs)}</td>
                  <td className="px-5 py-2.5 text-carbon/65">
                    {m.staffName}
                    {m.reason && ` · ${m.reason}`}
                    {m.orderId &&
                      (canOrders ? (
                        <Link href={`/orders/${m.orderId}`} className="ml-1 font-mono underline">
                          {orderRef(m.orderId)}
                        </Link>
                      ) : (
                        <span className="ml-1 font-mono">{orderRef(m.orderId)}</span>
                      ))}
                  </td>
                </tr>
              ))}
              {page.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-carbon/50">
                    No stock changes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {more && (
        <div className="mt-4 text-right text-[13px] font-semibold">
          <Link href={href({ after: page[page.length - 1].id })} className="underline underline-offset-2">
            Older
          </Link>
        </div>
      )}
    </>
  );
}
