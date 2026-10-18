"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/components/cart-provider";
import { useSupportVerb, useWhatsappHref } from "@/components/support-links";
import { formatNaira } from "@/lib/format";
import { CUSTOMER_STEPS, customerStep } from "@/lib/order-status";
import { orderHeadline, paymentLine } from "@/lib/order-copy";
import type { OrderStatus } from "@/generated/prisma/enums";
import { cancelOrder, orderAgain } from "./actions";

export type LiveOrder = {
  id: string;
  ref: string;
  status: OrderStatus;
  statusLabel: string;
  deliveryDateIso: string;
  cutoffIso: string;
  canCancel: boolean;
  total: number;
  itemCount: number;
  paymentMethod: string;
  paid: boolean;
  deliveredAtIso: string | null;
  rider: { name: string; phone: string } | null;
  preview: { emoji: string; publicId: string | null; name: string }[];
};

/** Orders from this delivery that are confirmed, on their way, or just arrived. */
export function LiveOrders({ deliveryId, orders }: { deliveryId: string; orders: LiveOrder[] }) {
  return (
    <div className="mt-4 grid gap-3">
      {orders.map((o) => (
        <OrderCard key={o.id} deliveryId={deliveryId} order={o} />
      ))}
    </div>
  );
}

function OrderCard({ deliveryId, order: o }: { deliveryId: string; order: LiveOrder }) {
  const cart = useCart();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<null | "cancel" | "again">(null);
  const { title, body } = orderHeadline(o);
  const step = customerStep(o.status);
  const helpHref = useWhatsappHref(`Hi, it's about order ${o.ref}.`);
  const helpVerb = useSupportVerb();

  const cancel = () =>
    start(async () => {
      const r = await cancelOrder(o.id);
      setConfirming(null);
      if (!r.ok) cart.announce(r.error, "error");
      else cart.announce(`Order ${o.ref} cancelled. Your items are still here.`);
    });

  const again = () =>
    start(async () => {
      const r = await orderAgain(deliveryId, o.id);
      setConfirming(null);
      if (!r.ok) cart.announce(r.error, "error");
      else cart.announce("Those items are back in your next order");
    });

  return (
    <article className={`rounded-2xl border p-4 ${o.status === "OUT_FOR_DELIVERY" ? "border-carbon bg-mint-pop/15" : "border-hairline bg-surface"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </div>
        <div className="flex shrink-0 -space-x-2">
          {o.preview.map((p, i) => (
            <ProductImage key={i} publicId={p.publicId} alt={p.name} emoji={p.emoji} sizes="32px" rounded="rounded-full" className="size-8 border-2 border-surface" emojiClassName="text-base" />
          ))}
        </div>
      </div>

      {step !== null && (
        <ol className="mt-3 grid grid-cols-4 gap-1" aria-label={`Status: ${o.statusLabel}`}>
          {CUSTOMER_STEPS.map((s, i) => (
            <li key={s} className="min-w-0">
              <span className={`block h-1.5 rounded-full ${i <= step ? "bg-carbon" : "bg-soft-mist"}`} />
              <span className={`mt-1 block truncate text-[11px] ${i === step ? "font-semibold" : "text-muted"}`}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-xs text-muted">
        {o.ref} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {paymentLine({ paidAt: o.paid ? o.deliveryDateIso : null, paymentMethod: o.paymentMethod, total: o.total, status: o.status }, formatNaira)}
      </p>

      {confirming ? (
        <div className="mt-3 rounded-xl bg-soft-mist p-3 text-sm">
          <p>{confirming === "cancel" ? "Cancel this order? Your items stay here, so you can change them and confirm again." : "Put these items back in your next order? They replace what's there now."}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant={confirming === "cancel" ? "danger" : "primary"} loading={pending} onClick={confirming === "cancel" ? cancel : again}>
              {confirming === "cancel" ? "Cancel order" : "Yes, add them"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {o.rider && (
            <LinkButton href={`tel:${o.rider.phone}`} size="sm" className="inline-flex items-center gap-1.5">
              <Icon name="phone" size={14} weight="bold" />
              Call {o.rider.name.split(" ")[0]}
            </LinkButton>
          )}
          {o.canCancel && (
            <Button size="sm" variant="secondary" onClick={() => setConfirming("cancel")}>
              Cancel order
            </Button>
          )}
          {o.status === "DELIVERED" && (
            <>
              <LinkButton href={`/orders/${o.id}?report=1`} size="sm" variant="secondary">
                Something wrong?
              </LinkButton>
              <Button size="sm" variant="secondary" onClick={() => (cart.items.length ? setConfirming("again") : again())} loading={pending && !confirming}>
                Order these again
              </Button>
            </>
          )}
          {o.status === "FAILED_DELIVERY" && (
            <a href={helpHref} target="_blank" rel="noreferrer" className="text-sm font-semibold underline underline-offset-2">
              {helpVerb}
            </a>
          )}
          <Link href={`/orders/${o.id}`} className="ml-auto text-sm font-semibold underline underline-offset-2">
            Details
          </Link>
        </div>
      )}
    </article>
  );
}
