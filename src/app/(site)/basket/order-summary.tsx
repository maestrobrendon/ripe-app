"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";
import { LinkButton } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { cutoffLabel, dayName, shortDate } from "@/lib/delivery-labels";
import type { DeliveryDay } from "@/generated/prisma/enums";

/**
 * What the order comes to right now, from the live lines: sold-out items
 * don't count, delivery is included, and account credit comes off. The same
 * sums checkout makes on the server.
 */
export function useOrderTotals(credit = 0) {
  const cart = useCart();
  const lines = cart.items.filter((l) => !l.soldOut);
  const member = cart.isSubscriber;
  const subtotal = lines.reduce((s, l) => s + (member ? l.memberPrice : l.standardPrice) * l.quantity, 0);
  const standard = lines.reduce((s, l) => s + l.standardPrice * l.quantity, 0);
  const memberTotal = lines.reduce((s, l) => s + l.memberPrice * l.quantity, 0);
  const quote = quoteDelivery(subtotal, cart.freeDelivery, cart.deliveryFee, cart.freeDeliveryThreshold);
  const fee = lines.length ? quote.fee : 0;
  const creditUsed = Math.min(credit, subtotal + fee);
  return {
    count: lines.length,
    subtotal,
    fee,
    toFreeDelivery: lines.length && !cart.freeDelivery ? quote.toFreeDelivery : 0,
    freeDelivery: cart.freeDelivery,
    creditUsed,
    total: subtotal + fee - creditUsed,
    member,
    /** Members: what membership saves on this order. Others: what it would. */
    saving: standard - memberTotal,
  };
}

export function OrderSummary({
  deliveryId,
  gated,
  day,
  canConfirm,
  dateIso,
  cutoffIso,
  credit,
  monthSaved,
}: {
  deliveryId: string;
  /** The free trial has been used: confirming needs a membership. */
  gated: boolean;
  day: DeliveryDay;
  canConfirm: boolean;
  dateIso: string | null;
  cutoffIso: string | null;
  credit: number;
  monthSaved: number;
}) {
  const t = useOrderTotals(credit);
  const href = `/checkout?b=${deliveryId}`;
  const ready = canConfirm && t.count > 0 && Boolean(dateIso);
  const label = `Confirm ${dayName(day)}'s basket`;

  return (
    <>
      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <h2 className="text-lg font-semibold">{dateIso ? `For ${shortDate(dateIso)}` : "Your basket"}</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <Row label={`Items (${t.count})`} value={formatNaira(t.subtotal)} />
            <Row label="Delivery" value={t.count === 0 ? "—" : t.fee ? formatNaira(t.fee) : "Free"} />
            {t.toFreeDelivery > 0 && <p className="-mt-1 text-xs text-muted">{formatNaira(t.toFreeDelivery)} more for free delivery</p>}
            {t.creditUsed > 0 && <Row label="Account credit" value={`−${formatNaira(t.creditUsed)}`} />}
            <div className="mt-1 flex items-baseline justify-between border-t border-hairline pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="text-xl font-semibold">{formatNaira(t.total)}</dd>
            </div>
          </dl>

          {gated ? (
            <LinkButton href="/subscribe?reason=free-basket-used" size="lg" className="mt-4 flex w-full justify-center">
              See membership
            </LinkButton>
          ) : ready ? (
            <LinkButton href={href} size="lg" className="mt-4 flex w-full justify-center">
              {label}
            </LinkButton>
          ) : (
            <button type="button" disabled className="mt-4 w-full rounded-control bg-carbon/40 px-8 py-4 text-base font-semibold text-paper-white">
              {label}
            </button>
          )}
          <p className="mt-3 text-xs text-muted">
            {gated
              ? "Your trial basket has been used. Members confirm their baskets every week and pay when they arrive."
              : `Pay when it arrives, or by bank transfer. Nothing is charged automatically.${cutoffIso ? ` Confirm by ${cutoffLabel(cutoffIso)}.` : ""}`}
          </p>

          <Savings saving={t.saving} member={t.member} monthSaved={monthSaved} />
        </div>
      </aside>

      {t.count > 0 && (
        <div data-order-bar className="fixed inset-x-0 z-(--z-sticky) px-3 lg:hidden" style={{ bottom: "calc(var(--dock-height) + var(--dock-inset) + 0.5rem)" }}>
          <div className="mx-auto flex max-w-[28rem] items-center gap-3 rounded-full border border-hairline bg-surface/95 p-1.5 pl-5 shadow-lg backdrop-blur">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-semibold">{formatNaira(t.total)}</p>
              <p className="truncate text-xs text-muted">
                {t.fee ? `incl. ${formatNaira(t.fee)} delivery` : "Free delivery"}
                {t.creditUsed ? ` · ${formatNaira(t.creditUsed)} credit off` : ""}
              </p>
            </div>
            {gated ? (
              <LinkButton href="/subscribe?reason=free-basket-used" size="sm" className="shrink-0 rounded-full py-3">
                See membership
              </LinkButton>
            ) : ready ? (
              <LinkButton href={href} size="sm" className="shrink-0 rounded-full py-3">
                Confirm basket
              </LinkButton>
            ) : (
              <LinkButton href="/account/addresses?next=/basket" size="sm" className="shrink-0 rounded-full py-3">
                Add address
              </LinkButton>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** Said once, on the summary: what membership saves, or would. */
function Savings({ saving, member, monthSaved }: { saving: number; member: boolean; monthSaved: number }) {
  if (member) {
    if (saving <= 0 && monthSaved <= 0) return null;
    return (
      <p className="mt-3 rounded-xl bg-mint-pop/20 px-3 py-2 text-xs">
        {saving > 0 && <>Membership saves you {formatNaira(saving)} on this basket.</>}
        {monthSaved > 0 && <> {formatNaira(monthSaved)} saved so far this month.</>}
      </p>
    );
  }
  if (saving <= 0) return null;
  return (
    <p className="mt-3 rounded-xl bg-soft-mist px-3 py-2 text-xs">
      Members would pay {formatNaira(saving)} less for this basket.{" "}
      <Link href="/subscribe" className="font-semibold underline underline-offset-2">
        See membership
      </Link>
    </p>
  );
}
