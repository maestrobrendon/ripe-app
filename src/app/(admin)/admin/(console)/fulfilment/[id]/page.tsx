import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { STATUS_LABEL } from "@/lib/order-status";
import { formatOrderQty } from "@/lib/stock-core";
import { ymd } from "@/lib/delivery-dates";
import { Badge } from "../../../_ui/kit";
import { dayDate, orderRef, statusTone } from "../../../_ui/format";
import { PackChecklist } from "./pack-checklist";

export const metadata: Metadata = { title: "Pack order" };

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await requireStaffPage("fulfilment.view");
  const role = staff.role as Role;
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: id.slice(0, 40) },
    select: {
      id: true, status: true, version: true, customerName: true, zoneName: true, deliveryDate: true, internalNote: true,
      items: { select: { id: true, quantity: true, product: { select: { name: true, soldAs: true, referenceWeightG: true, imageEmoji: true } } } },
    },
  });
  if (!order) notFound();
  const items = [...order.items]
    .sort((a, b) => a.product.name.localeCompare(b.product.name))
    .map((i) => ({ id: i.id, name: i.product.name, emoji: i.product.imageEmoji, quantity: formatOrderQty(i.quantity, i.product) }));
  const canPack = can(role, "fulfilment.pack") || can(role, "orders.update_status");

  return (
    <div className="mx-auto max-w-lg">
      <Link href={`/fulfilment?day=${ymd(order.deliveryDate)}`} className="text-[13px] font-semibold text-carbon/60 underline underline-offset-2">
        ← {dayDate(order.deliveryDate)}
      </Link>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-[28px] font-semibold">{orderRef(order.id)}</h1>
          <p className="text-[15px]">
            {order.customerName} · <b className="font-semibold">{order.zoneName}</b>
          </p>
        </div>
        <Badge tone={statusTone(order.status)}>{STATUS_LABEL[order.status]}</Badge>
      </div>
      {order.internalNote && <p className="mt-3 rounded-xl bg-sunburst/25 px-3 py-2 text-[13px]">Note: {order.internalNote}</p>}
      <PackChecklist
        orderId={order.id}
        version={order.version}
        status={order.status}
        items={items}
        canPack={canPack}
      />
    </div>
  );
}
