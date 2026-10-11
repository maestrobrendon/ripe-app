import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { dayDate, orderRef } from "../../../../_ui/format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Packing slip" };

/** One page per order, for the bag: who it's for, where it goes, and a tick box per item. No prices. */
export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("orders.view");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: id.slice(0, 40) },
    include: { items: { include: { product: { select: { name: true, unit: true } } } } },
  });
  if (!order) notFound();
  const items = [...order.items].sort((a, b) => a.product.name.localeCompare(b.product.name));

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-paper-white p-8 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-carbon/50 uppercase">Basket · packing slip</p>
          <h1 className="mt-1 font-mono text-[28px] font-semibold">{orderRef(order.id)}</h1>
        </div>
        <PrintButton />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 text-[14px]">
        <div>
          <p className="text-[12px] text-carbon/50">For</p>
          <p className="text-[18px] font-semibold">{order.customerName}</p>
          <p className="mt-1 whitespace-pre-line">{order.address}</p>
          <p className="font-semibold">{order.zoneName}</p>
        </div>
        <div>
          <p className="text-[12px] text-carbon/50">Delivery</p>
          <p className="text-[18px] font-semibold">{dayDate(order.deliveryDate)}</p>
          <p className="mt-1">{order.orderType === "ONE_OFF" ? "Cart order" : "Basket order"}</p>
          <p>
            {items.length} line{items.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <table className="mt-8 w-full text-left text-[14px]">
        <thead className="border-b-2 border-carbon text-[12px] text-carbon/60">
          <tr>
            <th className="w-10 py-2" aria-label="Packed" />
            <th className="py-2 font-semibold">Item</th>
            <th className="py-2 text-right font-semibold">Quantity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10">
          {items.map((i) => (
            <tr key={i.id}>
              <td className="py-2.5">
                <span className="block h-5 w-5 rounded border-2 border-carbon/60" />
              </td>
              <td className="py-2.5 font-medium">{i.product.name}</td>
              <td className="py-2.5 text-right text-[16px] font-semibold tabular-nums">
                {i.quantity}
                {i.product.unit === "WEIGHT" ? " g" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-10 grid grid-cols-2 gap-6 text-[13px] text-carbon/60">
        <p className="border-t border-carbon/40 pt-2">Packed by</p>
        <p className="border-t border-carbon/40 pt-2">Checked by</p>
      </div>
    </div>
  );
}
