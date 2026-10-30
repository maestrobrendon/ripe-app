"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { formatNaira } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { RollingNumber } from "@/components/ui/rolling-number";
import { placeOrder, type PaymentChoice } from "@/app/(site)/checkout/actions";
import { Field, Kachi, Title } from "../start-flow";

/*
 * After the account: three short screens, same look as sign-up.
 *
 *   1. Your basket: what's in it and what it comes to. Pay now, big; Pay
 *      later, small, straight into their account with the basket saved.
 *   2. Where: the street and a landmark, and a phone for the rider only if
 *      we don't have one. Saved to the account as their Home address.
 *   3. Pay: with Paystack (card, bank transfer or USSD), which opens over
 *      the confirmed order. The address comes first because it sets the
 *      delivery fee, so the amount charged is the order's own total.
 *
 * Without Paystack, step 3 is our bank details before the address instead;
 * without either, step 1 says Confirm and they pay the rider.
 */

type Line = { productId: string; name: string; amount: string; total: number; publicId: string | null; emoji: string };
type Transfer = { bankName: string; accountNumber: string; accountName: string };

export function ConfirmFlow(p: {
  basketId: string;
  firstName: string;
  contact: { name: string; email: string; phone: string };
  lines: Line[];
  subtotal: number;
  fee: number;
  when: string;
  zone: { id: string; name: string };
  transfer: Transfer | null;
  /** Paystack is set up. */
  online: boolean;
  reference: string;
}) {
  const total = p.subtotal + p.fee;
  const steps = !p.online && p.transfer ? (["basket", "pay", "where"] as const) : (["basket", "where"] as const);
  type Step = (typeof steps)[number];
  const [[index, dir], setIndex] = useState<[number, 1 | -1]>([0, 1]);
  const step: Step = steps[index];
  const go = (to: number) => {
    setIndex(([from]) => [to, to >= from ? 1 : -1]);
    window.scrollTo({ top: 0 });
  };

  const [payment, setPayment] = useState<PaymentChoice>(p.online ? "ONLINE" : p.transfer ? "TRANSFER" : "POD");
  const paysNow = p.online || Boolean(p.transfer);
  const [line1, setLine1] = useState("");
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState(p.contact.phone);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const needsPhone = !p.contact.phone;

  const finish = () => {
    haptic("light");
    setError(null);
    track("checkout_submitted", { flow: "signup", payment });
    start(async () => {
      const r = await placeOrder({
        basketId: p.basketId,
        addressId: null,
        newAddress: { label: "Home", line1, landmark, zoneId: p.zone.id, isDefault: true },
        name: p.contact.name,
        phone,
        email: p.contact.email,
        payment,
        useCredit: false,
        reference: payment === "TRANSFER" ? p.reference : undefined,
      });
      // Success goes to the confirmed order. Anything else is one sentence here.
      if (r && !r.ok) {
        haptic("error");
        track("checkout_failed", { flow: "signup", error: r.error });
        setError(r.error);
      }
    });
  };

  const ready: Record<Step, boolean> = { basket: true, pay: true, where: line1.trim().length > 3 && (!needsPhone || phone.trim().length >= 7) };
  const cta: Record<Step, React.ReactNode> = {
    basket: paysNow ? (
      <>
        Pay <RollingNumber value={total} format={formatNaira} /> now
      </>
    ) : (
      <>
        Confirm my basket · <RollingNumber value={total} format={formatNaira} />
      </>
    ),
    pay: "I've sent it",
    where: pending ? "Placing your order…" : payment === "ONLINE" ? "Continue to payment" : "Place my order",
  };

  return (
    <div className="hm min-h-svh bg-paper-white text-carbon">
      <header className="sticky top-0 z-30 bg-paper-white/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center gap-4">
          {index === 0 ? (
            <span className="logo-wordmark text-[22px] leading-none">BasketNG</span>
          ) : (
            <motion.button type="button" onClick={() => go(index - 1)} whileTap={{ scale: press.scale }} aria-label="Back" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-(--hm-tint)">
              <Icon name="caretLeft" size={20} />
            </motion.button>
          )}
          <div className="flex flex-1 gap-1.5" role="progressbar" aria-label="Confirming your basket" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1}>
            {steps.map((s, i) => (
              <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--hm-tint-2)">
                <motion.span className="block h-full origin-left rounded-full bg-carbon" initial={false} animate={{ scaleX: i <= index ? 1 : 0 }} transition={spring.smooth} />
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-[min(560px,calc(100%-32px))] pt-4 pb-44">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.section
            key={step}
            custom={dir}
            variants={{ enter: (d: number) => ({ x: 32 * d, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: -32 * d, opacity: 0 }) }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.smooth}
          >
            {step === "basket" && (
              <>
                <Kachi>You&apos;re in, {p.firstName}. Here&apos;s your basket. {paysNow ? "Pay now and it's locked in." : "Confirm it and it's locked in."}</Kachi>
                <Title>Your basket</Title>
                <Receipt name={p.contact.name} when={p.when} zone={p.zone.name} lines={p.lines} subtotal={p.subtotal} fee={p.fee} total={total} reference={p.reference} firstName={p.firstName} />
              </>
            )}

            {step === "pay" && p.transfer && (
              <>
                <Kachi>Send it from your bank app, I&apos;ll wait. Use the reference so we can match it.</Kachi>
                <Title>Send {formatNaira(total)}</Title>
                <div className="hm-panel mt-6 divide-y divide-(--hm-line)">
                  <CopyRow label="Account number" value={p.transfer.accountNumber} big />
                  <CopyRow label="Bank" value={p.transfer.bankName} />
                  <CopyRow label="Account name" value={p.transfer.accountName} />
                  <CopyRow label="Amount" value={String(total)} shown={formatNaira(total)} />
                  <CopyRow label="Reference" value={p.reference} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPayment("POD");
                    go(steps.indexOf("where"));
                  }}
                  className="mt-4 w-full py-2 text-center text-[13px] text-(--hm-ink-3) underline decoration-(--hm-line) underline-offset-4"
                >
                  Pay when it arrives instead
                </button>
              </>
            )}

            {step === "where" && (
              <>
                <Kachi>{payment === "TRANSFER" ? "Got it, thank you. " : ""}{payment === "ONLINE" ? "Where should I send it? Then you'll pay, and it's done." : "Last bit: where should I send it?"}</Kachi>
                <Title>Where should we bring it?</Title>
                <p className="mt-2 text-[15px] text-(--hm-ink-2)">In {p.zone.name}. We&apos;ll save it as your Home address.</p>
                <div className="mt-6 space-y-3">
                  <Field label="House number and street" name="line1" autoComplete="street-address" placeholder="12 Admiralty Way" value={line1} onChange={(e) => setLine1(e.target.value)} />
                  <Field label="Nearest landmark (optional)" name="landmark" placeholder="Opposite the filling station" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
                  {needsPhone && <Field label="Phone for the rider" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />}
                </div>
                {p.online && (
                  <button
                    type="button"
                    onClick={() => setPayment(payment === "ONLINE" ? "POD" : "ONLINE")}
                    className="mt-4 w-full py-2 text-center text-[13px] text-(--hm-ink-3) underline decoration-(--hm-line) underline-offset-4"
                  >
                    {payment === "ONLINE" ? "Pay when it arrives instead" : "Pay now instead"}
                  </button>
                )}
                {error && (
                  <p role="alert" className="mt-4 rounded-[18px] bg-ember/12 p-4 text-[14px] leading-relaxed">
                    {error}
                  </p>
                )}
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* The next move under the thumb; the quiet way out under that. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-paper-white from-70% to-paper-white/0 pt-6 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-[min(560px,calc(100%-32px))]">
          <motion.button
            type="button"
            disabled={!ready[step] || pending}
            onClick={() => {
              if (step === "where") return finish();
              haptic("light");
              go(index + 1);
            }}
            whileTap={{ scale: press.scale }}
            transition={spring.snappy}
            className="flex h-14 w-full items-center justify-center gap-1.5 rounded-full bg-carbon text-[16px] font-semibold text-paper-white transition-colors disabled:bg-(--hm-tint-2) disabled:text-carbon/60"
          >
            {cta[step]}
          </motion.button>
          {step === "basket" && (
            <Link href="/basket" onClick={() => haptic("selection")} className="mx-auto mt-2 block w-fit py-1.5 text-[13px] text-(--hm-ink-3) underline decoration-(--hm-line) underline-offset-4">
              Pay later
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** One bank detail, with a copy button that says so. */
function CopyRow({ label, value, shown, big }: { label: string; value: string; shown?: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-(--hm-ink-3)">{label}</span>
        <b className={`block truncate font-semibold tabular-nums ${big ? "text-[22px] tracking-[0.02em]" : "text-[16px]"}`}>{shown ?? value}</b>
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            haptic("selection");
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            /* select-and-copy still works */
          }
        }}
        className="shrink-0 rounded-full bg-(--hm-tint) px-3 py-1.5 text-[13px] font-semibold transition-transform active:scale-95"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/**
 * The basket as a till receipt: it prints out of a slot as the screen opens.
 * Names and prices only, like the real thing; the reference matches the
 * transfer on the next screen.
 */
function Receipt(r: { name: string; firstName: string; when: string; zone: string; lines: Line[]; subtotal: number; fee: number; total: number; reference: string }) {
  const still = useReducedMotion();
  const items = r.lines.length;
  return (
    <div className="mt-6">
      {/* The printer's slot. */}
      <div className="mx-auto h-2.5 w-[calc(100%+8px)] -translate-x-1 rounded-full bg-carbon/85" aria-hidden />
      <motion.div
        className="hm-receipt-shadow -mt-1 px-2.5"
        initial={still ? false : { clipPath: "inset(0 0 100% 0)", y: -14 }}
        animate={{ clipPath: "inset(0 0 0% 0)", y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      >
        <div className="hm-receipt px-5 pt-7 pb-8 text-[14px]">
          <div className="text-center">
            <p className="logo-wordmark text-[26px] leading-none">BasketNG</p>
            <p className="mt-2 text-[12px] tracking-[0.08em] text-(--hm-ink-3) uppercase">Fresh fruit and veg, Lagos</p>
          </div>

          <hr className="hm-receipt-rule my-4" />
          <dl className="grid gap-1 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-(--hm-ink-3)">For</dt>
              <dd className="truncate font-medium">{r.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-(--hm-ink-3)">Arrives</dt>
              <dd className="text-right font-medium">{r.when}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-(--hm-ink-3)">To</dt>
              <dd className="font-medium">{r.zone}</dd>
            </div>
          </dl>

          <hr className="hm-receipt-rule my-4" />
          <ul className="grid gap-2.5">
            {r.lines.map((l, i) => (
              <motion.li
                key={l.productId}
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 + Math.min(i, 12) * 0.05 }}
                className="flex items-baseline gap-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{l.name}</span>
                  <span className="block text-[12px] text-(--hm-ink-3)">{l.amount}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatNaira(l.total)}</span>
              </motion.li>
            ))}
          </ul>

          <hr className="hm-receipt-rule my-4" />
          <dl className="grid gap-1.5">
            <div className="flex justify-between text-(--hm-ink-2)">
              <dt>
                {items} {items === 1 ? "item" : "items"}
              </dt>
              <dd className="tabular-nums">{formatNaira(r.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-(--hm-ink-2)">
              <dt>Delivery</dt>
              <dd className="tabular-nums">{r.fee ? formatNaira(r.fee) : "Free"}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t-2 border-carbon pt-3">
              <dt className="text-[13px] font-semibold tracking-[0.08em] uppercase">Total</dt>
              <dd className="text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums">{formatNaira(r.total)}</dd>
            </div>
          </dl>

          <hr className="hm-receipt-rule my-4" />
          <div className="text-center">
            <p className="font-mono text-[13px] tracking-[0.12em]">REF {r.reference}</p>
            <p className="mt-2 text-[13px] text-(--hm-ink-2)">Thank you, {r.firstName}. Picked fresh for you.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
