"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCart } from "@/components/cart-provider";
import { StepIndicator } from "@/components/step-indicator";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { RollingNumber } from "@/components/ui/rolling-number";
import { spring } from "@/lib/motion/tokens";
import { formatNaira, DELIVERY_DAY_LABEL } from "@/lib/format";
import { quoteDelivery } from "@/lib/pricing";
import { placeOrder, type CheckoutInput } from "./actions";
import type { DeliveryDay } from "@/generated/prisma/enums";

const STEPS = ["Address", "Delivery window", "Payment", "Review"];
const DAYS: DeliveryDay[] = ["MONDAY", "WEDNESDAY", "FRIDAY"];

export function CheckoutFlow({
  zones,
  defaults,
  source,
  basketId,
  shoppingWindowLabel,
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
  source?: "basket";
  basketId?: string;
  shoppingWindowLabel?: string | null;
}) {
  const cart = useCart();
  const isBasket = source === "basket";
  const [[step, direction], setStepState] = useState<[number, 1 | -1]>([1, 1]);
  const goTo = (next: number) => setStepState([next, next > step ? 1 : -1]);
  const [form, setForm] = useState<CheckoutInput>({
    name: defaults.name,
    phone: defaults.phone,
    email: defaults.email,
    address: defaults.address,
    zoneSlug: defaults.zoneSlug || zones[0]?.slug || "",
    deliveryDay: defaults.deliveryDay,
    paymentMethod: "card",
    source,
    basketId,
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

      <div className="mt-8 overflow-hidden rounded-card border border-border bg-surface p-6">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: 40 * d, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: -40 * d, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.smooth}
          >
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
                <Button disabled={!addressValid} onClick={() => goTo(2)} size="md">
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium">Delivery window</h2>
                {isBasket ? (
                  <p className="rounded-lg border border-border p-3 text-sm">
                    This basket is scheduled to ship on{" "}
                    <span className="font-medium">{shoppingWindowLabel ?? "your chosen day"}</span>. Change it
                    on the basket page.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted">We deliver on these days in your zone. Pick the one that works.</p>
                    <div className="space-y-2">
                      {DAYS.map((d) => (
                        <RadioCard key={d} selected={form.deliveryDay === d} onSelect={() => set("deliveryDay", d)} groupId="delivery-day">
                          {DELIVERY_DAY_LABEL[d]} · 9am to 5pm
                        </RadioCard>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => goTo(1)}>Back</Button>
                  <Button onClick={() => goTo(3)}>Continue</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium">Payment method</h2>
                {process.env.NODE_ENV !== "production" && (
                  <p className="inline-flex rounded-full border border-border bg-sky-wash px-2.5 py-1 text-xs font-medium text-carbon">
                    Test mode. No real payment is taken
                  </p>
                )}
                <div className="space-y-2">
                  {(["card", "transfer"] as const).map((m) => (
                    <RadioCard key={m} selected={form.paymentMethod === m} onSelect={() => set("paymentMethod", m)} groupId="payment-method">
                      {m === "card" ? "Card" : "Bank transfer"}
                      {process.env.NODE_ENV !== "production" && " (test mode)"}
                    </RadioCard>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => goTo(2)}>Back</Button>
                  <Button onClick={() => goTo(4)}>Continue</Button>
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
                      <li key={i.productId} className="flex items-center gap-3 py-2 text-sm">
                        <ProductImage
                          publicId={i.cloudinaryPublicId}
                          alt={i.name}
                          emoji={i.imageEmoji}
                          className="h-9 w-9 shrink-0"
                          rounded="rounded-lg"
                          emojiClassName="text-base"
                          sizes="36px"
                        />
                        <span className="min-w-0 flex-1 truncate">{i.name} × {i.quantity}</span>
                        <span className="shrink-0">{formatNaira(price * i.quantity)}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="space-y-1 border-t border-border pt-4 text-sm">
                  <Row label="Subtotal" value={formatNaira(cart.subtotal)} />
                  <Row label="Delivery" value={delivery.isFree ? "Free" : formatNaira(delivery.fee)} />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>
                      <RollingNumber value={total} format={formatNaira} />
                    </span>
                  </div>
                  <Row
                    label="Delivers"
                    value={
                      isBasket
                        ? `${shoppingWindowLabel ?? "Your chosen day"}, 9am to 5pm`
                        : `${DELIVERY_DAY_LABEL[form.deliveryDay]}, 9am to 5pm`
                    }
                  />
                  <Row label="To" value={`${form.address} (${zones.find((z) => z.slug === form.zoneSlug)?.name ?? ""})`} />
                  <Row
                    label="Payment"
                    value={
                      form.paymentMethod === "card"
                        ? process.env.NODE_ENV !== "production" ? "Card (test mode)" : "Card"
                        : process.env.NODE_ENV !== "production" ? "Bank transfer (test mode)" : "Bank transfer"
                    }
                  />
                </div>
                {error && <p className="rounded-input border border-border bg-ember/12 p-3 text-sm text-carbon">{error}</p>}
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => goTo(3)} disabled={isPending}>Back</Button>
                  <Button onClick={submit} disabled={isPending}>
                    {isPending ? "Placing order…" : "Place order"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

const input = "w-full rounded-input border border-border px-3 py-2 text-sm";

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
