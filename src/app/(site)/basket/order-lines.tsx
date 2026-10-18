"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useCart, type AddableProduct, type CartLine } from "@/components/cart-provider";
import { ProductImage } from "@/components/product-image";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatNaira } from "@/lib/format";
import { quantityLabel, shortDate, unitPriceLabel } from "@/lib/delivery-labels";
import { orderAgain, startFromGoal } from "./actions";
import { useOrderTotals } from "./order-summary";

const asProduct = (l: CartLine): AddableProduct => ({
  id: l.productId,
  slug: l.slug,
  name: l.name,
  unit: l.unit,
  orderUnit: l.orderUnit,
  minOrderQty: l.minOrderQty,
  stepQty: l.stepQty,
  imageEmoji: l.imageEmoji,
  cloudinaryPublicId: l.cloudinaryPublicId,
  memberPrice: l.memberPrice,
  standardPrice: l.standardPrice,
  soldOut: l.soldOut,
});

/**
 * What's in the order, straight from the cart provider so every tap shows at
 * once. Quantities read the way people say them, each line has one price,
 * and removing something can be undone from the toast. A sold-out line says
 * so and offers a swap.
 */
export function OrderLines({
  deliveryId,
  swaps,
  lastOrder,
  goalLabel,
}: {
  deliveryId: string;
  swaps: Record<string, AddableProduct>;
  lastOrder: { id: string; itemCount: number; dateIso: string } | null;
  goalLabel: string | null;
}) {
  const cart = useCart();
  const t = useOrderTotals();

  if (cart.items.length === 0) return <EmptyOrder deliveryId={deliveryId} lastOrder={lastOrder} goalLabel={goalLabel} />;

  return (
    <section aria-labelledby="in-order">
      <div className="flex items-baseline justify-between">
        <h2 id="in-order" className="text-lg font-semibold">
          In this order
        </h2>
        <span className="text-sm text-muted">
          {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="mt-2 divide-y divide-hairline rounded-2xl border border-hairline bg-surface">
        {cart.items.map((l) => (
          <Line key={l.productId} line={l} swap={swaps[l.productId] ?? null} />
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Icon name="plus" size={14} weight="bold" />
          Add more from the shop
        </Link>
        {t.toFreeDelivery > 0 && <span className="text-xs text-muted">{formatNaira(t.toFreeDelivery)} more for free delivery</span>}
      </div>

      {/* The desktop summary says this; on a phone it lives here, once. */}
      {t.saving > 0 && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-xs lg:hidden ${t.member ? "bg-mint-pop/20" : "bg-soft-mist"}`}>
          {t.member ? (
            <>Membership saves you {formatNaira(t.saving)} on this order.</>
          ) : (
            <>
              Members would pay {formatNaira(t.saving)} less for this order.{" "}
              <Link href="/subscribe" className="font-semibold underline underline-offset-2">
                See membership
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}

function Line({ line: l, swap }: { line: CartLine; swap: AddableProduct | null }) {
  const cart = useCart();
  const product = asProduct(l);
  const price = cart.isSubscriber ? l.memberPrice : l.standardPrice;
  const href = `/products/${l.slug}`;

  const swapIt = async () => {
    if (!swap) return;
    await cart.setQuantity(swap, swap.minOrderQty);
    await cart.setQuantity(product, 0);
  };

  return (
    <li className="flex gap-3 p-3">
      <Link href={href} className={`shrink-0 ${l.soldOut ? "opacity-50" : ""}`}>
        <ProductImage publicId={l.cloudinaryPublicId} alt={l.name} emoji={l.imageEmoji} sizes="64px" className="size-16" emojiClassName="text-3xl" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="line-clamp-2 font-medium leading-snug hover:underline">
            {l.name}
          </Link>
          <span className={`shrink-0 font-semibold ${l.soldOut ? "text-muted line-through" : ""}`}>{formatNaira(price * l.quantity)}</span>
        </div>
        <p className="text-xs text-muted">
          {quantityLabel(l.quantity, l.unit)} · {unitPriceLabel(formatNaira(price), l.unit)}
        </p>

        {l.soldOut ? (
          <div className="mt-2 rounded-xl bg-soft-mist p-2.5 text-xs">
            <p>
              <b className="font-semibold">Sold out this week.</b> It won&apos;t be in this order.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {swap && (
                <button type="button" onClick={swapIt} className="rounded-full bg-carbon px-3 py-1.5 font-semibold text-paper-white">
                  Swap for {swap.name}
                </button>
              )}
              <button type="button" onClick={() => cart.setQuantity(product, 0)} className="rounded-full border border-hairline bg-surface px-3 py-1.5 font-semibold">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2">
            {l.limited ? <span className="rounded-full bg-ember/12 px-2 py-0.5 text-[11px] font-medium">Limited this week</span> : <span />}
            <QuantityStepper
              variant="inline"
              quantity={l.quantity}
              min={l.minOrderQty}
              step={l.stepQty}
              label={l.name}
              loading={cart.loadingProductId === l.productId}
              onChange={(n) => cart.setQuantity(product, n)}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/** An empty order: ways to start that take one tap. */
function EmptyOrder({ deliveryId, lastOrder, goalLabel }: { deliveryId: string; lastOrder: { id: string; itemCount: number; dateIso: string } | null; goalLabel: string | null }) {
  const cart = useCart();
  const [pending, start] = useTransition();

  const go = (action: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await action();
      if (!r.ok) cart.announce(r.error ?? "That didn't go through. Try again.", "error");
      else cart.announce(done);
    });

  return (
    <section className="rounded-2xl border border-dashed border-hairline p-5">
      <h2 className="text-lg font-semibold">Nothing in this order yet</h2>
      <p className="mt-1 text-sm text-muted">Add what you need for the week. Nothing is ordered until you confirm.</p>
      <div className="mt-4 grid gap-2" aria-busy={pending}>
        {lastOrder && (
          <Option
            icon="history"
            title="Order these again"
            sub={`${lastOrder.itemCount} item${lastOrder.itemCount === 1 ? "" : "s"} from ${shortDate(lastOrder.dateIso)}`}
            disabled={pending}
            onClick={() => go(() => orderAgain(deliveryId, lastOrder.id), "Your last order is back in")}
          />
        )}
        <Option
          icon="spark"
          title={goalLabel ? `A starter set for “${goalLabel}”` : "A starter set"}
          sub="Sized for your household. Change anything."
          disabled={pending}
          onClick={() => go(() => startFromGoal(deliveryId), "Added a starter set")}
        />
        <Option icon="shop" title="Browse the shop" sub="Fruit, vegetables and boxes" href="/shop" />
        <Option icon="assistant" title="Ask Kachi" sub="Say what you're cooking and it fills the order" href="/assistant" />
      </div>
    </section>
  );
}

function Option({ icon, title, sub, onClick, href, disabled }: { icon: IconName; title: string; sub: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-soft-mist">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="block text-[13px] text-muted">{sub}</small>
      </span>
      <Icon name="caretRight" size={16} className="shrink-0 text-muted" />
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-2xl border border-hairline bg-surface px-3 py-3 text-left transition hover:bg-sky-wash disabled:opacity-60";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {body}
    </button>
  );
}
