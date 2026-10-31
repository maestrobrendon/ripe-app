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
import { awaitingPayment, orderBadge, orderHeadline, paymentLine, type OrderTone } from "@/lib/order-copy";
import { DELIVERY_WINDOW, cutoffLabel, longDate } from "@/lib/delivery-labels";
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
  /** Its delivery day is today in Lagos (worked out on the server, where the clock is). */
  isToday: boolean;
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

const TONE_DOT: Record<OrderTone, string> = {
  good: "bg-mint-pop",
  wait: "bg-sunburst",
  alert: "bg-ember",
  quiet: "bg-black/25",
};

/** Still to come, so its delivery window is worth saying. */
const UPCOMING: OrderStatus[] = ["RECEIVED", "CONFIRMED", "PICKING", "PACKED"];

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

/*
 * One order, read top to bottom the way you'd ask about it: what state is it
 * in, when is it coming, how far along is it, and what's in it. The day is
 * the headline. Cancelling is there but quiet, at the bottom, in red.
 */
function OrderCard({ deliveryId, order: o }: { deliveryId: string; order: LiveOrder }) {
  const cart = useCart();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<null | "cancel" | "again">(null);
  const waiting = awaitingPayment({ paidAt: o.paid ? "paid" : null, paymentMethod: o.paymentMethod, status: o.status });
  const { title, body } = orderHeadline({ ...o, awaitingPayment: waiting });
  const badge = orderBadge({ ...o, awaitingPayment: waiting });
  const step = customerStep(o.status);
  const helpHref = useWhatsappHref(`Hi, it's about order ${o.ref}.`);
  const helpVerb = useSupportVerb();

  const [weekday, ...dateRest] = longDate(o.deliveryDateIso).split(" ");
  const today = o.isToday;
  const upcoming = UPCOMING.includes(o.status) && badge.tone !== "alert";
  // A confirmed order that can still change says so beside the cancel button instead.
  const note = o.canCancel && !waiting && (o.status === "RECEIVED" || o.status === "CONFIRMED") ? null : body;
  const payment = paymentLine({ paidAt: o.paid ? o.deliveryDateIso : null, paymentMethod: o.paymentMethod, total: o.total, status: o.status }, formatNaira);
  const hasActions = waiting || o.rider || o.status === "DELIVERED" || o.status === "FAILED_DELIVERY";

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
    <article
      aria-label={title}
      className={`overflow-hidden rounded-[22px] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(0_0_0/0.18)] ring-1 ${o.status === "OUT_FOR_DELIVERY" ? "ring-carbon" : "ring-black/[0.06]"}`}
    >
      <div className="px-5 pt-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <span aria-hidden className={`size-2 rounded-full ${TONE_DOT[badge.tone]}`} />
          {badge.label}
        </p>
        <h2 className="mt-1.5 text-[30px] leading-[1.05] font-semibold tracking-[-0.025em]">{today ? "Today" : weekday}</h2>
        <p className="mt-1 text-[15px] text-muted">
          {today ? longDate(o.deliveryDateIso) : dateRest.join(" ")}
          {upcoming && ` · ${DELIVERY_WINDOW}`}
        </p>
        {note && <p className="mt-3 text-[15px] leading-snug text-carbon/80">{note}</p>}

        {step !== null && badge.tone !== "alert" && (
          <div className="mt-5">
            <ol className="flex gap-1" aria-label={`Status: ${o.statusLabel}`}>
              {CUSTOMER_STEPS.map((s, i) => (
                <li key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-carbon" : "bg-black/[0.08]"}`}>
                  <span className="sr-only">
                    {s}
                    {i === step ? " (now)" : i < step ? " (done)" : ""}
                  </span>
                </li>
              ))}
            </ol>
            <p aria-hidden className="mt-2 flex justify-between gap-3 text-[13px]">
              <span className="font-semibold">{CUSTOMER_STEPS[step]}</span>
              {step < CUSTOMER_STEPS.length - 1 && <span className="text-muted">Next: {CUSTOMER_STEPS[step + 1].toLowerCase()}</span>}
            </p>
          </div>
        )}

        {hasActions && !confirming && (
          <div className="mt-4 flex flex-wrap gap-2">
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
            {o.status === "DELIVERED" && (
              <>
                <Button size="sm" variant="secondary" onClick={() => (cart.items.length ? setConfirming("again") : again())} loading={pending && !confirming}>
                  Order these again
                </Button>
                <LinkButton href={`/orders/${o.id}?report=1`} size="sm" variant="secondary">
                  Something wrong?
                </LinkButton>
              </>
            )}
            {o.status === "FAILED_DELIVERY" && (
              <a href={helpHref} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full bg-carbon px-4 text-sm font-semibold text-white">
                {helpVerb}
              </a>
            )}
          </div>
        )}
      </div>

      {/* What's in it: one row, and the whole row opens the order. */}
      <Link href={`/orders/${o.id}`} className="mt-5 flex items-center gap-3 border-t border-black/[0.06] px-5 py-3.5 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]">
        <span className="flex shrink-0 -space-x-2.5">
          {o.preview.map((p, i) => (
            <ProductImage key={i} publicId={p.publicId} alt="" emoji={p.emoji} sizes="36px" rounded="rounded-full" className="size-9 bg-soft-mist ring-2 ring-surface" emojiClassName="text-lg" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">
            {o.basketLabel ? `${o.basketLabel} · ` : ""}
            {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
          </span>
          <span className="block truncate text-[13px] text-muted">
            {payment}
          </span>
        </span>
        <Icon name="caretRight" size={16} weight="bold" className="shrink-0 text-carbon/30" />
      </Link>

      {confirming === "cancel" ? (
        <div className="border-t border-black/[0.06] px-5 py-4 text-[15px]">
          <p className="mb-3">Cancel this order? Your items stay in your basket, so you can change them and confirm again.</p>
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
        <div className="border-t border-black/[0.06] px-5 py-4 text-[15px]">
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
        o.canCancel && (
          <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] py-2 pr-3 pl-5">
            <span className="text-[13px] text-muted">Changes until {cutoffLabel(o.cutoffIso)}</span>
            <button
              type="button"
              onClick={() => setConfirming("cancel")}
              className="shrink-0 rounded-full px-3 py-2 text-[15px] font-medium text-ember transition-[background-color,transform] hover:bg-ember/10 active:scale-95"
            >
              Cancel order
            </button>
          </div>
        )
      )}
    </article>
  );
}
