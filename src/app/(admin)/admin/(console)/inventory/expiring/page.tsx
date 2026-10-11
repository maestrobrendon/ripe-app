import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { lagosDate, ymd } from "@/lib/delivery-dates";
import { formatQty } from "@/lib/stock-core";
import { Badge, Card, PageHeader } from "../../../_ui/kit";
import { when } from "../../../_ui/format";

export const metadata: Metadata = { title: "Use first" };

const DAY = 86_400_000;

export default async function ExpiringPage() {
  await requireStaffPage("inventory.view");
  const today = lagosDate(new Date());
  const horizon = new Date(today.getTime() + 3 * DAY);
  const batches = await prisma.stockBatch.findMany({
    where: { remaining: { gt: 0 }, bestBefore: { not: null, lte: horizon } },
    orderBy: { bestBefore: "asc" },
    include: { product: { select: { id: true, name: true, soldAs: true } }, supplier: { select: { name: true } } },
    take: 300,
  });

  return (
    <>
      <PageHeader
        title="Use first"
        description="Stock at or near its best-before date (within 3 days). Packing already takes the oldest batch first; anything past its date should be recorded as waste."
        actions={
          <Link href="/inventory/waste" className="text-[13px] font-semibold underline underline-offset-2">
            Record waste
          </Link>
        }
      />
      <Card className="p-0! overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Product</th>
              <th className="px-3 py-2.5 text-right font-semibold">Left in batch</th>
              <th className="px-3 py-2.5 font-semibold">Best before</th>
              <th className="px-5 py-2.5 font-semibold">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {batches.map((b) => {
              const bb = b.bestBefore!;
              const days = Math.round((bb.getTime() - today.getTime()) / DAY);
              return (
                <tr key={b.id}>
                  <td className="px-5 py-2.5 font-medium">{b.product.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatQty(b.remaining, b.product.soldAs)}</td>
                  <td className="px-3 py-2.5">
                    {ymd(bb)}{" "}
                    <Badge tone={days < 0 ? "bad" : days <= 1 ? "warn" : "neutral"}>{days < 0 ? `${-days} day${days === -1 ? "" : "s"} past` : days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"}`}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-carbon/60">
                    {when(b.receivedAt)}
                    {b.supplier && ` · ${b.supplier.name}`}
                  </td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-carbon/50">
                  Nothing due in the next three days. Batches only show here when a best-before date was recorded at receiving.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
