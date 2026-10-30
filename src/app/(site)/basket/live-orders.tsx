"use client";

import { TypeToConfirm } from "@/components/ui/type-to-confirm";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/product-image";
import { useCart } from "@/components/cart-provider";
import { useSupportVerb, useWhatsappHref } from "@/components/support-links";
import { formatNaira } from "@/lib/format";
import { CUSTOMER_STEPS, customerStep } from "@/lib/order-status";
import { awaitingPayment, orderHeadline, paymentLine } from "@/lib/order-copy";
import type { OrderStatus } from "@/generated/prisma/enums";
import { cancelOrder, orderAgain } from "./actions";

export type LiveOrder = {
  id: string;
  ref: string;
  /** The basket it came from, when that isn't the one Home is showing. */
  basketLabel: string | null;
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
  const waiting = awaitingPayment({ paidAt: o.paid ? "paid" : null, paymentMethod: o.paymentMethod, status: o.status });
  const { title, body } = orderHeadline({ ...o, awaitingPayment: waiting });
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
      else cart.announce("Those items are back in your basket");
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
        {o.basketLabel ? `${o.basketLabel} · ` : ""}
        {o.ref} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {paymentLine({ paidAt: o.paid ? o.deliveryDateIso : null, paymentMethod: o.paymentMethod, total: o.total, status: o.status }, formatNaira)}
      </p>

      {confirming === "cancel" ? (
        <div className="mt-3 rounded-xl bg-soft-mist p-3 text-sm">
          <p className="mb-3">Cancel this order? Your items stay here, so you can change them and confirm again.</p>
          <TypeToConfirm phrase="Cancel order">
            {(ready) => (
              <div className="flex gap-2">
                <Button size="sm" variant="danger" loading={pending} disabled={!ready} onClick={cancel}>
                  Cancel order
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
                  Keep it
                </Button>
              </div>
            )}
          </TypeToConfirm>
        </div>
      ) : confirming === "again" ? (
        <div className="mt-3 rounded-xl bg-soft-mist p-3 text-sm">
          <p>Put these items back in your basket? They replace what&apos;s there now.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" loading={pending} onClick={again}>
              Yes, add them
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {waiting && (
            <LinkButton href={`/orders/${o.id}?pay=1`} size="sm">
              Pay {formatNaira(o.total)} now
            </LinkButton>
          )}
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
