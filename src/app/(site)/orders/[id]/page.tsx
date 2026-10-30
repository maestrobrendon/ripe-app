import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { timingSafeEqual } from "crypto";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ProductImage } from "@/components/product-image";
import { formatNaira } from "@/lib/format";
import { CUSTOMER_STEPS, customerStep } from "@/lib/order-status";
import { getSiteSettings } from "@/lib/site-settings";
import { transferReady } from "@/lib/site-settings-schema";
import { supportHref } from "@/lib/support";
import { cutoffFor } from "@/lib/delivery-dates";
import { DELIVERY_WINDOW, longDate, orderRef, quantityLabel } from "@/lib/delivery-labels";
import { orderHeadline, paymentLine, ISSUE_KINDS } from "@/lib/order-copy";
import { formatPhone } from "@/lib/phone";
import { getOrCreateActiveDelivery } from "@/lib/order-container";
import { OrderControls } from "./order-controls";
import { PlacedMoment } from "./placed-moment";
import { appOrigin } from "@/lib/site";
import { paystackReady } from "@/lib/paystack";
import { payForOrder } from "@/lib/payment-actions";
import { PayButton } from "@/components/payments/pay-button";
import { deliveryEvent, googleCalendarUrl } from "@/lib/delivery-calendar";

export const metadata = { title: "Your order" };

function tokenMatches(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** One order: where it is, what's in it, how it's paid, and what can still be done about it. */
export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; placed?: string; report?: string; pay?: string }> }) {
  const [{ id }, { t, placed, report, pay }, user] = await Promise.all([params, searchParams, getCurrentUser()]);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      deliveryRun: { include: { rider: true } },
      deliveryZone: { select: { cutoffHour: true } },
      issues: { orderBy: { createdAt: "desc" } },
      basket: { select: { oneOff: true, name: true } },
    },
  });
  if (!order) notFound();

  const ownsIt = Boolean(user && order.userId && order.userId === user.id);
  const hasValidToken = Boolean(t) && tokenMatches(t!, order.accessToken);
  // Same response as "not found" so the endpoint does not confirm the order exists.
  if (!ownsIt && !hasValidToken) notFound();

  const settings = await getSiteSettings();
  const ref = orderRef(order.id);
  const cutoff = cutoffFor(order.deliveryDate, order.deliveryZone?.cutoffHour ?? 18);
  const canCancel = ownsIt && order.status === "RECEIVED" && checkOpen(cutoff);
  const rider = order.status === "OUT_FOR_DELIVERY" && order.deliveryRun?.rider ? order.deliveryRun.rider : null;
  const { title, body } = orderHeadline({ status: order.status, deliveryDateIso: order.deliveryDate.toISOString(), cutoffIso: cutoff.toISOString(), canCancel, rider });
  const step = customerStep(order.status) ?? -1;
  const stopped = order.status === "CANCELLED" || order.status === "REFUNDED";
  const canReport = ownsIt && (order.status === "DELIVERED" || order.status === "FAILED_DELIVERY") && withinDays(order.deliveredAt ?? order.deliveryDate, 7);
  const activeDelivery = ownsIt && user ? await getOrCreateActiveDelivery(user) : null;
  const activeCount = activeDelivery ? await prisma.basketItem.count({ where: { basketId: activeDelivery.id } }) : 0;
  const unpaidTransfer = !order.paidAt && /transfer/i.test(order.paymentMethod) && !stopped && transferReady(settings.transfer);
  // Any unpaid order can be paid online, whatever was chosen at checkout.
  const payOnline = ownsIt && !order.paidAt && !stopped && order.total > 0 && paystackReady();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-grouped">
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6">
      {ownsIt && (
        <BackButton fallback="/orders" label="Orders" />
      )}

      {placed && !stopped && (
        <PlacedMoment
          title={order.basket?.oneOff ? "Order confirmed" : "Basket confirmed"}
          when={`${longDate(order.deliveryDate)}, ${DELIVERY_WINDOW}`}
          pay={paymentLine({ paidAt: order.paidAt, paymentMethod: order.paymentMethod, total: order.total, status: order.status }, formatNaira)}
          receiptTo={order.customerEmail}
          calendarHref={`/orders/${order.id}/calendar${hasValidToken && !ownsIt ? `?t=${encodeURIComponent(t!)}` : ""}`}
          googleCalendarHref={googleCalendarUrl(deliveryEvent({ ...order, basketName: order.basket?.name }), `${appOrigin()}/orders/${order.id}`)}
        />
      )}

      <p className="mt-4 text-sm text-muted">Order {ref}</p>
      {/* Just confirmed: the moment above already says it, so the heading is for screen readers only. */}
      <h1 className={placed && !stopped ? "sr-only" : "mt-1 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px]"}>{title}</h1>
      <p className="mt-1 text-sm text-muted">{body}</p>

      {!stopped && step >= 0 && (
        <ol className="mt-5 flex items-start justify-between rounded-2xl bg-surface px-2 py-4 ring-1 ring-hairline" aria-label="Progress">
          {CUSTOMER_STEPS.map((label, i) => (
            <li key={label} className="relative flex flex-1 flex-col items-center text-center">
              {i < CUSTOMER_STEPS.length - 1 && <span aria-hidden className={`absolute top-4 left-1/2 h-px w-full ${i < step ? "bg-carbon" : "bg-border"}`} />}
              <span className={`relative z-10 flex size-8 items-center justify-center rounded-full text-xs font-medium ${i <= step ? "bg-carbon text-white" : "border border-hairline bg-surface text-muted"}`}>
                {i <= step ? <Check size={14} weight="bold" aria-hidden /> : i + 1}
              </span>
              <span className={`mt-2 text-xs ${i <= step ? "font-medium" : "text-muted"}`}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {rider && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-carbon bg-mint-pop/15 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{rider.name}</p>
            <p className="text-sm text-muted">Your rider · {formatPhone(rider.phone)}</p>
          </div>
          <a href={`tel:${rider.phone}`} className="shrink-0 rounded-full bg-carbon px-4 py-2 text-sm font-semibold text-paper-white">
            Call
          </a>
        </div>
      )}

      {payOnline && (
        <div className="mt-5 rounded-2xl bg-surface p-4 ring-1 ring-hairline">
          <p className="font-semibold">{formatNaira(order.total)} to pay</p>
          <p className="mt-0.5 mb-3.5 text-sm text-muted">Pay now and it&apos;s settled before the rider comes.</p>
          <PayButton start={payForOrder.bind(null, order.id)} label={`Pay ${formatNaira(order.total)} now`} autoStart={pay === "1"} />
        </div>
      )}

      {unpaidTransfer && (
        <div className="mt-5 rounded-2xl border border-hairline bg-surface p-4 text-sm">
          <p className="font-semibold">{payOnline ? "Or transfer" : "Transfer"} {formatNaira(order.total)} to</p>
          <p className="mt-1">
            {settings.transfer.accountName}
            <br />
            {settings.transfer.bankName} · <b className="font-semibold">{settings.transfer.accountNumber}</b>
          </p>
          <p className="mt-2 text-muted">Use {ref} as the reference. We&apos;ll pack it once the money arrives, and mark it paid here.</p>
        </div>
      )}

      {ownsIt && (
        <OrderControls
          orderId={order.id}
          ref_={ref}
          canCancel={canCancel}
          canReport={canReport}
          openReport={Boolean(report) && canReport}
          canOrderAgain={order.status === "DELIVERED" || stopped}
          activeDeliveryId={activeDelivery?.id ?? null}
          activeHasItems={activeCount > 0}
          itemNames={order.items.map((i) => i.product.name)}
          helpHref={supportHref(settings.support, `Hi, it's about order ${ref}.`, `Order ${ref}`)}
        />
      )}

      {order.issues.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">What you told us</h2>
          <ul className="mt-2 grid gap-2">
            {order.issues.map((i) => (
              <li key={i.id} className="rounded-2xl border border-hairline bg-surface p-3 text-sm">
                <p className="font-semibold">{ISSUE_KINDS.find((k) => k.id === i.kind)?.label ?? i.kind}</p>
                {i.items.length > 0 && <p className="text-muted">{i.items.join(", ")}</p>}
                {i.note && <p className="mt-1">&ldquo;{i.note}&rdquo;</p>}
                <p className="mt-2 text-xs">{i.status === "RESOLVED" ? `Sorted: ${i.resolution ?? "resolved"}` : "We're on it. We'll message you shortly."}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 grid gap-4 rounded-2xl bg-surface p-4 text-sm shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline sm:grid-cols-2">
        <Detail label="When">
          {longDate(order.deliveryDate)}, {DELIVERY_WINDOW}
        </Detail>
        <Detail label="Where">
          {order.address} ({order.zoneName})
          {order.landmark && <span className="block text-muted">Near {order.landmark}</span>}
          {order.deliveryNote && <span className="block text-muted">{order.deliveryNote}</span>}
        </Detail>
        <Detail label="Contact">
          {order.customerName} · {formatPhone(order.customerPhone)}
          {order.altPhone && <span className="block text-muted">Also {formatPhone(order.altPhone)}</span>}
        </Detail>
        <Detail label="Payment">{paymentLine(order, formatNaira)}</Detail>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 px-4 text-[13px] font-semibold tracking-[0.02em] text-carbon/55 uppercase">Items</h2>
        <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_rgb(0_0_0/0.04)] ring-1 ring-hairline">
        <ul className="divide-y divide-hairline">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 p-3 text-sm">
              <ProductImage publicId={i.product.cloudinaryPublicId} alt={i.product.name} emoji={i.product.imageEmoji} className="size-10 shrink-0" rounded="rounded-lg" emojiClassName="text-lg" sizes="40px" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{i.product.name}</span>
                <small className="text-muted">{quantityLabel(i.quantity, i.product.unit)}</small>
              </span>
              <span className="shrink-0">{formatNaira(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid gap-1.5 border-t border-hairline bg-black/[0.015] px-4 py-3.5 text-sm">
          <Row label="Items" value={formatNaira(order.subtotal)} />
          <Row label="Delivery" value={order.deliveryFee === 0 ? "Free" : formatNaira(order.deliveryFee)} />
          {order.creditApplied > 0 && <Row label="Account credit" value={`−${formatNaira(order.creditApplied)}`} />}
          <div className="mt-1 flex items-baseline justify-between border-t border-hairline pt-2.5 font-semibold">
            <dt>Total</dt>
            <dd className="text-[17px]">{formatNaira(order.total)}</dd>
          </div>
        </dl>
        </div>
      </section>
    </div>
    </div>
  );
}

function checkOpen(cutoff: Date) {
  return Date.now() < cutoff.getTime();
}

function withinDays(d: Date, days: number) {
  return Date.now() - d.getTime() <= days * 86_400_000;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
