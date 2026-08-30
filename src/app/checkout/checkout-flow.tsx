"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/components/cart-provider";
import { StepIndicator } from "@/components/step-indicator";
import { formatNaira, DELIVERY_DAY_LABEL } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { placeOrder, type CheckoutInput } from "./actions";
import type { DeliveryDay } from "@/generated/prisma/enums";

const STEPS = ["Address", "Delivery window", "Payment", "Review"];
const DAYS: DeliveryDay[] = ["MONDAY", "WEDNESDAY", "FRIDAY"];

export function CheckoutFlow({
  zones,
  defaults,
}: {
  zones: { slug: string; name: string; area: string }[];
  defaults: {
    name: string;
    phone: string;
    email: string;
    address: string;
    zoneSlug: string;
    deliveryDay: DeliveryDay;
  };
}) {
  const cart = useCart();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CheckoutInput>({
    name: defaults.name,
    phone: defaults.phone,
    email: defaults.email,
    address: defaults.address,
    zoneSlug: defaults.zoneSlug || zones[0]?.slug || "",
    deliveryDay: defaults.deliveryDay,
    paymentMethod: "card",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof CheckoutInput>(key: K, value: CheckoutInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const delivery = quoteDelivery(cart.subtotal, cart.isSubscriber);
  const total = cart.subtotal + delivery.fee;

  const addressValid = form.name && form.phone && form.address && form.zoneSlug;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        await placeOrder(form);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  return (
    <>
      <div className="mt-6">
        <StepIndicator steps={STEPS} currentStep={step} />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Delivery address</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Phone number">
                <input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="080..." />
              </Field>
            </div>
            <Field label="Email (optional)">
              <input className={input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Delivery address">
              <textarea className={input} rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Delivery zone">
              <select className={input} value={form.zoneSlug} onChange={(e) => set("zoneSlug", e.target.value)}>
                {zones.map((z) => (
                  <option key={z.slug} value={z.slug}>{z.name} ({z.area})</option>
                ))}
              </select>
            </Field>
            <button
              disabled={!addressValid}
              onClick={() => setStep(2)}
              className={nextBtn(Boolean(addressValid))}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Choose a delivery window</h2>
            <p className="text-sm text-muted">We deliver on these days in your zone. Pick the one that works.</p>
            <div className="space-y-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => set("deliveryDay", d)}
                  className={`block w-full rounded-lg border p-3 text-left text-sm ${
                    form.deliveryDay === d ? "border-ripe-green bg-ripe-green-light" : "border-border"
                  }`}
                >
                  {DELIVERY_DAY_LABEL[d]} · 9am to 5pm
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className={backBtn}>Back</button>
              <button onClick={() => setStep(3)} className={nextBtn(true)}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Payment method</h2>
            <p className="text-xs font-medium uppercase tracking-wide text-ripe-terracotta-dark">
              Test mode. No real payment is taken
            </p>
            <div className="space-y-2">
              {(["card", "transfer"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => set("paymentMethod", m)}
                  className={`block w-full rounded-lg border p-3 text-left text-sm ${
                    form.paymentMethod === m ? "border-ripe-green bg-ripe-green-light" : "border-border"
                  }`}
                >
                  {m === "card" ? "Card (test mode)" : "Bank transfer (test mode)"}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className={backBtn}>Back</button>
              <button onClick={() => setStep(4)} className={nextBtn(true)}>Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Review your order</h2>
            <ul className="divide-y divide-border">
              {cart.items.map((i) => {
                const price = cart.isSubscriber ? i.memberPrice : i.standardPrice;
                return (
                  <li key={i.productId} className="flex justify-between py-2 text-sm">
                    <span>{i.imageEmoji} {i.name} × {i.quantity}</span>
                    <span>{formatNaira(price * i.quantity)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-1 border-t border-border pt-4 text-sm">
              <Row label="Subtotal" value={formatNaira(cart.subtotal)} />
              <Row label="Delivery" value={delivery.isFree ? "Free" : formatNaira(delivery.fee)} />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatNaira(total)}</span>
              </div>
              <Row label="Delivers" value={`${DELIVERY_DAY_LABEL[form.deliveryDay]}, 9am to 5pm`} />
              <Row label="To" value={`${form.address} (${zones.find((z) => z.slug === form.zoneSlug)?.name ?? ""})`} />
              <Row label="Payment" value={form.paymentMethod === "card" ? "Card (test mode)" : "Bank transfer (test mode)"} />
            </div>
            {error && <p className="rounded-lg bg-ripe-terracotta-light p-3 text-sm text-ripe-terracotta-dark">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className={backBtn} disabled={isPending}>Back</button>
              <button
                onClick={submit}
                disabled={isPending}
                className="rounded-full bg-ripe-terracotta px-6 py-2.5 text-sm font-medium text-white hover:bg-ripe-terracotta-dark disabled:opacity-60"
              >
                {isPending ? "Placing order…" : "Place order"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const input =
  "w-full rounded-lg border border-border px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

const backBtn =
  "rounded-full border border-border px-6 py-2.5 text-sm font-medium hover:bg-ripe-green-light disabled:opacity-60";

function nextBtn(enabled: boolean) {
  return `rounded-full px-6 py-2.5 text-sm font-medium text-white ${
    enabled ? "bg-ripe-green hover:bg-ripe-green-dark" : "cursor-not-allowed bg-ripe-green/40"
  }`;
}
