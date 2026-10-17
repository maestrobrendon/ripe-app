import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/admin/guard";
import { can, type Role } from "@/lib/admin/permissions";
import { maskEmail, maskPhone } from "@/lib/admin/pii";
import { canRefundFrom, canTransition, nextStatuses, STATUS_LABEL } from "@/lib/order-status";
import { formatOrderQty } from "@/lib/stock-core";
import { Badge, Card, PageHeader } from "../../../_ui/kit";
import { dayDate, naira, orderRef, statusTone, when } from "../../../_ui/format";
import { OrderActions, OrderNotes, RevealContact } from "./order-panels";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await requireStaffPage("orders.view");
  const role = staff.role as Role;
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: id.slice(0, 40) },
    include: {
      items: { include: { product: { select: { name: true, unit: true, slug: true, soldAs: true, referenceWeightG: true } } }, orderBy: { id: "asc" } },
      events: { orderBy: { at: "asc" } },
      credits: { orderBy: { createdAt: "asc" } },
      user: { select: { id: true, subscriptionTier: { select: { name: true } } } },
    },
  });
  if (!order) notFound();

  const moves = nextStatuses(order.status)
    .filter((to) => to !== "CANCELLED" && canTransition(order.status, to, (p) => can(role, p)))
    .map((to) => ({ to, label: STATUS_LABEL[to] }));
  const refunded = order.credits.filter((c) => c.kind === "REFUND").reduce((s, c) => s + c.amount, 0);
  const canCancel = canTransition(order.status, "CANCELLED", (p) => can(role, p));
  const canRefund = can(role, "orders.refund") && Boolean(order.paidAt) && canRefundFrom(order.status) && refunded < order.total;

  return (
    <>
      <PageHeader
        title={`Order ${orderRef(order.id)}`}
        description={
          <>
            Placed {when(order.createdAt)} · {order.orderType === "ONE_OFF" ? "Cart order" : "Basket order"}
            {order.user?.subscriptionTier && ` · ${order.user.subscriptionTier.name}`}
          </>
        }
        actions={
          <div className="flex items-center gap-3">
            <Badge tone={statusTone(order.status)}>{STATUS_LABEL[order.status]}</Badge>
            <Link href={`/orders/${order.id}/slip`} className="text-[13px] font-semibold underline underline-offset-2">
              Packing slip
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <OrderActions
            orderId={order.id}
            version={order.version}
            moves={moves}
            canCancel={canCancel}
            canRefund={canRefund}
            leftToRefund={order.total - refunded}
          />

          <Card title={`Items (${order.items.length})`} className="p-0! overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <thead className="border-y border-black/6 bg-soft-mist/40 text-[12px] text-carbon/55">
                <tr>
                  <th className="px-5 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Each</th>
                  <th className="px-5 py-2 text-right font-semibold">Line</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2.5 font-medium">{i.product.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatOrderQty(i.quantity, i.product)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{naira(i.unitPrice)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{naira(i.unitPrice * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-black/6 text-[13px]">
                <tr>
                  <td colSpan={3} className="px-5 pt-3 text-right text-carbon/60">Subtotal</td>
                  <td className="px-5 pt-3 text-right tabular-nums">{naira(order.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-5 text-right text-carbon/60">Delivery</td>
                  <td className="px-5 text-right tabular-nums">{order.deliveryFee ? naira(order.deliveryFee) : "Free"}</td>
                </tr>
                <tr className="font-semibold">
                  <td colSpan={3} className="px-5 pb-3 text-right">Total</td>
                  <td className="px-5 pb-3 text-right tabular-nums">{naira(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card title="Timeline">
            <ol className="space-y-3 border-l-2 border-soft-mist pl-4">
              {order.events.map((e) => (
                <li key={e.id} className="text-[13px]">
                  <p>
                    <b className="font-semibold">
                      {e.kind === "STATUS" && e.toStatus ? STATUS_LABEL[e.toStatus] : e.kind === "REFUND" ? "Refund" : e.kind === "EMAIL" ? "Email" : "Note"}
                    </b>{" "}
                    <span className="text-carbon/50">
                      · {e.actorName} · {when(e.at)}
                    </span>
                  </p>
                  {e.note && <p className="mt-0.5 whitespace-pre-line text-carbon/75">{e.note}</p>}
                </li>
              ))}
              {order.events.length === 0 && <li className="text-[13px] text-carbon/50">Placed {when(order.createdAt)}, before order timelines existed.</li>}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Delivery">
            <dl className="space-y-2 text-[13px]">
              <div>
                <dt className="text-carbon/50">Day</dt>
                <dd className="font-semibold">{dayDate(order.deliveryDate)}</dd>
              </div>
              <div>
                <dt className="text-carbon/50">Area</dt>
                <dd>{order.zoneName}</dd>
              </div>
              <div>
                <dt className="text-carbon/50">Address</dt>
                <dd className="whitespace-pre-line">{order.address}</dd>
              </div>
              {order.deliveredAt && (
                <div>
                  <dt className="text-carbon/50">Delivered</dt>
                  <dd>{when(order.deliveredAt)}</dd>
                </div>
              )}
              {order.cancelReason && (
                <div>
                  <dt className="text-carbon/50">Cancelled because</dt>
                  <dd>{order.cancelReason}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Customer">
            <p className="text-[14px] font-semibold">{order.customerName}</p>
            <RevealContact
              orderId={order.id}
              maskedPhone={maskPhone(order.customerPhone)}
              maskedEmail={maskEmail(order.customerEmail)}
              canReveal={can(role, "customers.reveal_pii")}
            />
            {order.user && can(role, "customers.view") && (
              <Link href={`/customers/${order.user.id}`} className="mt-3 inline-block text-[13px] font-semibold underline underline-offset-2">
                Customer profile
              </Link>
            )}
          </Card>

          <Card title="Payment">
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-carbon/50">Method</dt>
                <dd>{order.paymentMethod}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-carbon/50">Paid</dt>
                <dd>{order.paidAt ? when(order.paidAt) : "Not paid"}</dd>
              </div>
              {refunded > 0 && (
                <div className="flex justify-between">
                  <dt className="text-carbon/50">Refunded</dt>
                  <dd className="font-semibold">{naira(refunded)}</dd>
                </div>
              )}
            </dl>
            {order.credits.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-black/6 pt-3 text-[12px] text-carbon/65">
                {order.credits.map((c) => (
                  <li key={c.id}>
                    {naira(c.amount)} by {c.method}, {when(c.createdAt)} ({c.staffName}): {c.reason}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <OrderNotes orderId={order.id} note={order.internalNote ?? ""} canEdit={can(role, "orders.notes")} />
        </div>
      </div>
    </>
  );
}
