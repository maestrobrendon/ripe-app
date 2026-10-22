import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auditStaff, requireStaffPage } from "@/lib/admin/guard";
import { dayDate, orderRef } from "../../../../../_ui/format";
import { PrintButton } from "../../../../../_ui/print-button";

export const metadata: Metadata = { title: "Rider sheet" };

/**
 * The printed sheet a rider carries: stops in order with name, address and
 * phone. Phones are personal data; the sheet only goes to whoever runs
 * deliveries, and every view is recorded.
 */
export default async function ManifestPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaffPage("delivery.manage_runs");
  const { id } = await params;
  const run = await prisma.deliveryRun.findUnique({
    where: { id: id.slice(0, 40) },
    include: {
      rider: { select: { name: true, phone: true } },
      orders: {
        orderBy: { runSequence: "asc" },
        select: { id: true, customerName: true, customerPhone: true, address: true, zoneName: true, total: true, paidAt: true, internalNote: true, _count: { select: { items: true } } },
      },
    },
  });
  if (!run) notFound();
  await auditStaff(ctx, { action: "delivery.manifest_viewed", targetType: "DeliveryRun", targetId: run.id, summary: `Rider sheet for ${run.name} (${run.orders.length} stops)` });

  return (
    <div className="mx-auto max-w-3xl rounded-2xl bg-paper-white p-8 shadow-[0_0_0_1px_rgb(0_0_0/0.06)] print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-carbon/50 uppercase">Basket · rider sheet</p>
          <h1 className="mt-1 text-[26px] font-semibold">{run.name}</h1>
          <p className="text-[14px]">
            {dayDate(run.day)} · {run.rider ? `${run.rider.name} (${run.rider.phone})` : "No rider assigned"}
          </p>
        </div>
        <PrintButton />
      </div>
      <ol className="mt-6 divide-y divide-black/10">
        {run.orders.map((o, i) => (
          <li key={o.id} className="flex gap-4 py-4 print:break-inside-avoid">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-carbon text-[15px] font-bold">{i + 1}</span>
            <div className="flex-1">
              <p className="text-[16px] font-semibold">
                {o.customerName} <span className="font-mono text-[12px] font-normal text-carbon/50">{orderRef(o.id)}</span>
              </p>
              <p className="text-[14px]">{o.address}</p>
              <p className="text-[13px] text-carbon/60">
                {o.zoneName} · {o._count.items} item{o._count.items === 1 ? "" : "s"} · {o.paidAt ? "Paid" : "NOT PAID"}
              </p>
              <p className="mt-1 text-[15px] font-semibold tabular-nums">{o.customerPhone}</p>
              {o.internalNote && <p className="mt-1 text-[13px]">Note: {o.internalNote}</p>}
            </div>
            <div className="w-28 shrink-0 space-y-2 text-[12px] text-carbon/60">
              <p className="border-b border-carbon/40 pb-3">Delivered</p>
              <p className="border-b border-carbon/40 pb-3">Signature</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
