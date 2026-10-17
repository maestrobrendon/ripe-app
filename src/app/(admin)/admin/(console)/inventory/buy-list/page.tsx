import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { committedByProduct } from "@/lib/stock";
import { formatQty } from "@/lib/stock-core";
import { Card, PageHeader } from "../../../_ui/kit";
import { naira, when } from "../../../_ui/format";
import { PrintButton } from "../../../_ui/print-button";

export const metadata: Metadata = { title: "Buy list" };

/**
 * What to buy at market: everything open orders still need beyond what's on
 * hand, plus a top-up to each product's reorder point. Grouped by supplier,
 * with a cost estimate from the last price paid.
 */
export default async function BuyListPage() {
  await requireStaffPage("inventory.view");
  const [products, committed] = await Promise.all([
    prisma.product.findMany({
      where: { NOT: { tags: { has: "fresh-cuts" } }, availability: { not: "HIDDEN" } },
      select: { id: true, name: true, soldAs: true, stockOnHand: true, reorderPoint: true, supplier: { select: { name: true, phone: true, market: true } } },
    }),
    committedByProduct(),
  ]);
  const lastCosts = await prisma.stockMovement.findMany({
    where: { kind: "RECEIVE", unitCost: { not: null } },
    orderBy: { at: "desc" },
    distinct: ["productId"],
    select: { productId: true, unitCost: true },
  });
  const cost = new Map(lastCosts.map((c) => [c.productId, c.unitCost!]));

  const lines = products
    .map((p) => {
      const promised = committed.get(p.id) ?? 0;
      const free = p.stockOnHand - promised;
      const forOrders = Math.max(0, -free);
      const topUp = p.reorderPoint !== null && free < p.reorderPoint ? p.reorderPoint - Math.max(free, 0) : 0;
      const toBuy = forOrders + topUp;
      const unitCost = cost.get(p.id);
      // Costs were entered per kg or per item.
      const estimate = unitCost !== undefined ? Math.round((p.soldAs === "WEIGHT" ? toBuy / 1000 : toBuy) * unitCost) : null;
      return { ...p, promised, forOrders, topUp, toBuy, estimate };
    })
    .filter((l) => l.toBuy > 0)
    .sort((a, b) => (a.supplier?.name ?? "~").localeCompare(b.supplier?.name ?? "~") || a.name.localeCompare(b.name));

  const groups = [...new Set(lines.map((l) => l.supplier?.name ?? "No supplier set"))];
  const total = lines.reduce((s, l) => s + (l.estimate ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Buy list"
        description={`For open orders not yet packed, plus top-ups to reorder points. Made ${when(new Date())}.`}
        actions={<PrintButton />}
      />
      {lines.length === 0 ? (
        <Card>
          <p className="text-[13px] text-carbon/55">Nothing to buy: stock covers every open order and no product is under its reorder point.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const gl = lines.filter((l) => (l.supplier?.name ?? "No supplier set") === g);
            const s = gl[0].supplier;
            return (
              <Card key={g} title={g} actions={s && (s.phone || s.market) ? <span className="text-[12px] text-carbon/55">{[s.market, s.phone].filter(Boolean).join(" · ")}</span> : undefined} className="p-0! overflow-hidden print:break-inside-avoid">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-y border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
                    <tr>
                      <th className="w-10 px-5 py-2" aria-label="Bought" />
                      <th className="px-2 py-2 font-semibold">Product</th>
                      <th className="px-3 py-2 text-right font-semibold">For orders</th>
                      <th className="px-3 py-2 text-right font-semibold">Top-up</th>
                      <th className="px-3 py-2 text-right font-semibold">Buy</th>
                      <th className="px-5 py-2 text-right font-semibold">About</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {gl.map((l) => (
                      <tr key={l.id}>
                        <td className="px-5 py-2">
                          <span className="block h-4 w-4 rounded border-2 border-carbon/50" />
                        </td>
                        <td className="px-2 py-2 font-medium">{l.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.forOrders ? formatQty(l.forOrders, l.soldAs) : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.topUp ? formatQty(l.topUp, l.soldAs) : "—"}</td>
                        <td className="px-3 py-2 text-right text-[15px] font-semibold tabular-nums">{formatQty(l.toBuy, l.soldAs)}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-carbon/60">{l.estimate !== null ? naira(l.estimate) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
          <p className="text-right text-[14px]">
            Estimated spend <b className="font-semibold tabular-nums">{naira(total)}</b>
            <span className="block text-[12px] text-carbon/50">From the last price paid per product; lines without one aren&apos;t counted.</span>
          </p>
        </div>
      )}
    </>
  );
}
