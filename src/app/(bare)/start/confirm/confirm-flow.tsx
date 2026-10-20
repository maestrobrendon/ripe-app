"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
import { formatNaira } from "@/lib/format";
import { ProductImage } from "@/components/product-image";
import { Icon } from "@/components/ui/icon";
import { RollingNumber } from "@/components/ui/rolling-number";
import { placeOrder, type PaymentChoice } from "@/app/(site)/checkout/actions";
import { Field, Kachi, Title } from "../start-flow";

/*
 * After the account: three short screens, same look as sign-up.
 *
 *   1. Your basket: what's in it and what it comes to. Pay now, big; Pay
 *      later, small, straight into their account with the basket saved.
 *   2. Pay: the bank details, the exact amount and a reference to use.
 *      (Paystack goes here when it's connected: card in, same screen.)
 *   3. Where: the street and a landmark, and a phone for the rider only if
 *      we don't have one. Saved to the account as their Home address.
 *
 * Without bank transfer set up there's nothing to pay now, so step 1 says
 * Confirm instead and step 2 is skipped: they pay the rider.
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
  reference: string;
}) {
  const total = p.subtotal + p.fee;
  const steps = p.transfer ? (["basket", "pay", "where"] as const) : (["basket", "where"] as const);
  type Step = (typeof steps)[number];
  const [[index, dir], setIndex] = useState<[number, 1 | -1]>([0, 1]);
  const step: Step = steps[index];
  const go = (to: number) => {
    setIndex(([from]) => [to, to >= from ? 1 : -1]);
    window.scrollTo({ top: 0 });
  };

  const [payment, setPayment] = useState<PaymentChoice>(p.transfer ? "TRANSFER" : "POD");
  const [line1, setLine1] = useState("");
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState(p.contact.phone);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const needsPhone = !p.contact.phone;

  const finish = () => {
    haptic("light");
    setError(null);
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
        setError(r.error);
      }
    });
  };

  const ready: Record<Step, boolean> = { basket: true, pay: true, where: line1.trim().length > 3 && (!needsPhone || phone.trim().length >= 7) };
  const cta: Record<Step, React.ReactNode> = {
    basket: p.transfer ? (
      <>
        Pay <RollingNumber value={total} format={formatNaira} /> now
      </>
    ) : (
      <>
        Confirm my basket · <RollingNumber value={total} format={formatNaira} />
      </>
    ),
    pay: "I've sent it",
    where: pending ? "Placing your order…" : "Place my order",
  };

  return (
    <div className="hm min-h-svh bg-paper-white text-carbon">
      <header className="sticky top-0 z-30 bg-paper-white/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center gap-4">
          {index === 0 ? (
            <span className="logo-wordmark text-[22px] leading-none">Basket</span>
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
                <Kachi>You&apos;re in, {p.firstName}. Here&apos;s your basket. {p.transfer ? "Pay now and it's locked in." : "Confirm it and it's locked in."}</Kachi>
                <Title>Your basket</Title>
                <p className="mt-2 text-[15px] text-(--hm-ink-2)">{p.when}</p>
                <ul className="hm-panel mt-5 divide-y divide-(--hm-line)">
                  {p.lines.map((l, i) => (
                    <motion.li key={l.productId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: 0.04 * i }} className="flex items-center gap-3 px-4 py-3">
                      <ProductImage publicId={l.publicId} alt="" emoji={l.emoji} sizes="40px" className="size-10 shrink-0" rounded="rounded-xl" emojiClassName="text-lg" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15px] font-semibold">{l.name}</b>
                        <span className="text-[13px] text-(--hm-ink-3)">{l.amount}</span>
                      </span>
                      <span className="shrink-0 text-[15px] tabular-nums">{formatNaira(l.total)}</span>
                    </motion.li>
                  ))}
                </ul>
                <dl className="mt-4 grid gap-1.5 px-1 text-[15px]">
                  <div className="flex justify-between text-(--hm-ink-2)">
                    <dt>Delivery to {p.zone.name}</dt>
                    <dd className="tabular-nums">{p.fee ? formatNaira(p.fee) : "Free"}</dd>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <dt className="font-semibold">Total</dt>
                    <dd className="text-[24px] font-semibold tracking-[-0.02em] tabular-nums">{formatNaira(total)}</dd>
                  </div>
                </dl>
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
                <Kachi>{payment === "TRANSFER" ? "Got it, thank you. " : ""}Last bit: where should I send it?</Kachi>
                <Title>Where should we bring it?</Title>
                <p className="mt-2 text-[15px] text-(--hm-ink-2)">In {p.zone.name}. We&apos;ll save it as your Home address.</p>
                <div className="mt-6 space-y-3">
                  <Field label="House number and street" name="line1" autoComplete="street-address" placeholder="12 Admiralty Way" value={line1} onChange={(e) => setLine1(e.target.value)} />
                  <Field label="Nearest landmark (optional)" name="landmark" placeholder="Opposite the filling station" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
                  {needsPhone && <Field label="Phone for the rider" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} />}
                </div>
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
            className="flex h-14 w-full items-center justify-center gap-1.5 rounded-full bg-carbon text-[16px] font-semibold text-paper-white transition-opacity disabled:opacity-30"
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
