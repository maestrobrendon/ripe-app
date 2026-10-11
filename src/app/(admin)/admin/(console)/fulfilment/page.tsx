import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { workDays } from "@/lib/admin/work-days";
import { STATUS_LABEL } from "@/lib/order-status";
import { formatQty, orderToStock } from "@/lib/stock-core";
import { Badge, Card, PageHeader } from "../../_ui/kit";
import { DayPicker } from "../../_ui/day-picker";
import { orderRef, statusTone } from "../../_ui/format";
import { PrintButton } from "../../_ui/print-button";
import { AdvanceButtons } from "./advance-buttons";

export const metadata: Metadata = { title: "Fulfilment" };

const WORK = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED"] as const;

export default async function FulfilmentPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { staff } = await requireStaffPage("fulfilment.view");
  const role = staff.role as Role;
  const { days, current, range } = await workDays([...WORK], (await searchParams).day);

  const orders = await prisma.order.findMany({
    where: { deliveryDate: range, status: { in: [...WORK] } },
    orderBy: [{ zoneName: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, status: true, customerName: true, zoneName: true, orderType: true,
      items: { select: { quantity: true, product: { select: { id: true, name: true, soldAs: true, referenceWeightG: true, stockOnHand: true } } } },
    },
  });

  // The pick list: everything still to be packed (confirmed or being picked), summed by product.
  const toPick = orders.filter((o) => o.status === "CONFIRMED" || o.status === "PICKING");
  const lines = new Map<string, { name: string; soldAs: string; quantity: number; orders: number; onHand: number }>();
  for (const o of toPick)
    for (const i of o.items) {
      const l = lines.get(i.product.id) ?? { name: i.product.name, soldAs: i.product.soldAs, quantity: 0, orders: 0, onHand: i.product.stockOnHand };
      // In stock units (grams for weighed produce), so it compares with what is on hand.
      l.quantity += orderToStock(i.quantity, i.product);
      l.orders += 1;
      lines.set(i.product.id, l);
    }
  const pick = [...lines.entries()].map(([id, l]) => ({ id, ...l })).sort((a, b) => a.name.localeCompare(b.name));
  const count = (s: string) => orders.filter((o) => o.status === s).length;

  return (
    <>
      <PageHeader
        title="Fulfilment"
        description="Confirm, pick and pack a day's orders. Packing takes stock (oldest batch first)."
        actions={<PrintButton />}
      />
      <DayPicker base="/fulfilment" days={days} current={current} />

      <div className="mb-5 grid gap-3 sm:grid-cols-4 print:hidden">
        {WORK.map((s) => (
          <Card key={s} className="p-4!">
            <p className="text-[12px] font-semibold text-carbon/55">{STATUS_LABEL[s]}</p>
            <p className="mt-1 text-[26px] font-semibold tabular-nums">{count(s)}</p>
          </Card>
        ))}
      </div>

      <AdvanceButtons
        day={current}
        received={count("RECEIVED")}
        confirmed={count("CONFIRMED")}
        canConfirm={can(role, "orders.update_status")}
        canPick={can(role, "orders.update_status") || can(role, "fulfilment.pack")}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card title={`Pick list (${pick.length} products from ${toPick.length} orders)`} className="p-0! overflow-hidden">
          {pick.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-carbon/50">Nothing to pick. Confirm the day&apos;s received orders first, or they&apos;re all packed.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead className="border-y border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
                <tr>
                  <th className="w-10 px-5 py-2" aria-label="Picked" />
                  <th className="px-2 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Pick</th>
                  <th className="px-3 py-2 text-right font-semibold">Orders</th>
                  <th className="px-5 py-2 text-right font-semibold">In stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {pick.map((l) => {
                  const short = l.onHand < l.quantity;
                  return (
                    <tr key={l.id}>
                      <td className="px-5 py-2">
                        <span className="block h-4 w-4 rounded border-2 border-carbon/50" />
                      </td>
                      <td className="px-2 py-2 font-medium">{l.name}</td>
                      <td className="px-3 py-2 text-right text-[15px] font-semibold tabular-nums">{formatQty(l.quantity, l.soldAs)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-carbon/60">{l.orders}</td>
                      <td className={`px-5 py-2 text-right tabular-nums ${short ? "font-semibold text-[#9a2c00]" : "text-carbon/60"}`}>
                        {formatQty(l.onHand, l.soldAs)}
                        {short && <span className="block text-[11px] font-normal">short {formatQty(l.quantity - l.onHand, l.soldAs)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={`Orders (${orders.length})`} className="print:hidden">
          <ul className="divide-y divide-black/5">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <Link href={`/fulfilment/${o.id}`} className="font-mono font-semibold hover:underline">
                    {orderRef(o.id)}
                  </Link>
                  <span className="block text-carbon/60">
                    {o.customerName} · {o.zoneName} · {o.items.length} line{o.items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>
              </li>
            ))}
            {orders.length === 0 && <li className="py-3 text-[13px] text-carbon/50">No orders to prepare for this day.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
