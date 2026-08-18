import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getStandingBasketView } from "@/lib/basket";
import { StepIndicator } from "@/components/step-indicator";
import { formatNaira, DELIVERY_DAY_LABEL } from "@/lib/format";
import { placeOrder } from "./actions";

const STEPS = ["Delivery day", "Address", "Payment", "Review"];

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; payment?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/subscribe");

  const view = await getStandingBasketView(user.id);
  if (!view || view.basket.items.length === 0) redirect("/basket");

  const { step: stepParam, payment } = await searchParams;
  const step = Math.min(Math.max(Number(stepParam ?? "1") || 1, 1), 4);
  const paymentMethod = payment ?? "card";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <div className="mt-6">
        <StepIndicator steps={STEPS} currentStep={step} />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        {step === 1 && (
          <div>
            <h2 className="text-lg font-medium">Confirm your delivery day</h2>
            <p className="mt-2 text-sm text-muted">
              Your standing basket delivers every {DELIVERY_DAY_LABEL[view.basket.deliveryDay]}. You can
              change this any time from your basket.
            </p>
            <Link
              href="/checkout?step=2"
              className="mt-6 inline-block rounded-full bg-ripe-green px-6 py-2.5 text-sm font-medium text-white hover:bg-ripe-green-dark"
            >
              Confirm and continue
            </Link>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-medium">Confirm your delivery address</h2>
            <p className="mt-2 text-sm text-muted">{user.address}</p>
            <p className="text-sm text-muted">{user.zone.name} — {user.zone.area}</p>
            <div className="mt-6 flex gap-3">
              <Link href="/checkout?step=1" className="rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-ripe-green-light">
                Back
              </Link>
              <Link href="/checkout?step=3" className="rounded-full bg-ripe-green px-6 py-2.5 text-sm font-medium text-white hover:bg-ripe-green-dark">
                Confirm and continue
              </Link>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-medium">Payment method</h2>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ripe-terracotta-dark">
              Test mode — no real payment is taken
            </p>
            <div className="mt-4 space-y-2">
              <Link
                href="/checkout?step=4&payment=card"
                className={`block rounded-lg border p-3 text-sm ${paymentMethod === "card" ? "border-ripe-green bg-ripe-green-light" : "border-border"}`}
              >
                Card (test mode)
              </Link>
              <Link
                href="/checkout?step=4&payment=transfer"
                className={`block rounded-lg border p-3 text-sm ${paymentMethod === "transfer" ? "border-ripe-green bg-ripe-green-light" : "border-border"}`}
              >
                Bank transfer (test mode)
              </Link>
            </div>
            <Link href="/checkout?step=2" className="mt-6 inline-block rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-ripe-green-light">
              Back
            </Link>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-medium">Review your order</h2>
            <ul className="mt-4 divide-y divide-border">
              {view.basket.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{i.product.imageEmoji} {i.product.name} × {i.quantity}</span>
                  <span>{formatNaira(i.product.memberPrice * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted">
                <span>Market price</span>
                <span className="line-through">{formatNaira(view.marketSubtotal)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatNaira(view.memberSubtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Payment method</span>
                <span>{paymentMethod === "card" ? "Card (test mode)" : "Bank transfer (test mode)"}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Delivers</span>
                <span>{DELIVERY_DAY_LABEL[view.basket.deliveryDay]}</span>
              </div>
            </div>
            <form action={placeOrder} className="mt-6 flex gap-3">
              <Link href="/checkout?step=3" className="rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-ripe-green-light">
                Back
              </Link>
              <button type="submit" className="rounded-full bg-ripe-terracotta px-6 py-2.5 text-sm font-medium text-white hover:bg-ripe-terracotta-dark">
                Place order
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
