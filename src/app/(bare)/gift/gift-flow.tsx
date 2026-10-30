"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { press, spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
import { track } from "@/lib/analytics";
import { formatNaira } from "@/lib/format";
import { GIFT_DESIGNS, GIFT_VALUES } from "@/lib/gift-config";
import { Icon } from "@/components/ui/icon";
import { GiftCard } from "@/components/gift/gift-card";
import { PayButton } from "@/components/payments/pay-button";
import { startGift } from "./actions";

/*
 * Gift a basket, one screen at a time: who it's for, how big, a note and a
 * colour, then pay. The card on the last screen is exactly what they'll open.
 */

type Step = "intro" | "who" | "size" | "note" | "pay";
const STEPS: Step[] = ["who", "size", "note", "pay"];

export function GiftFlow({ signedIn, firstName, online }: { signedIn: boolean; firstName: string; online: boolean }) {
  const router = useRouter();
  const still = useReducedMotion();
  const [step, setStep] = useState<Step>("intro");
  const [dir, setDir] = useState<1 | -1>(1);
  const [to, setTo] = useState("");
  const [contact, setContact] = useState("");
  const [amount, setAmount] = useState<number>(GIFT_VALUES[1].amount);
  const [message, setMessage] = useState("");
  const [design, setDesign] = useState<string>(GIFT_DESIGNS[0].id);
  const [from, setFrom] = useState(firstName);

  const index = STEPS.indexOf(step);
  const go = (s: Step, d: 1 | -1 = 1) => {
    setDir(d);
    setStep(s);
    window.scrollTo({ top: 0 });
  };
  const next = () => {
    haptic("light");
    if (step === "intro") {
      track("gift_started");
      return go("who");
    }
    go(STEPS[index + 1]);
  };
  const back = () => go(index <= 0 ? "intro" : STEPS[index - 1], -1);
  const ready: Record<Step, boolean> = { intro: true, who: to.trim().length > 1, size: Boolean(amount), note: true, pay: true };

  return (
    <div className="hm min-h-svh bg-paper-white text-carbon">
      <header className="sticky top-0 z-30 bg-paper-white/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-[min(560px,calc(100%-32px))] items-center gap-4">
          {step === "intro" ? (
            <Link href="/" className="logo-wordmark text-[22px] leading-none">
              BasketNG
            </Link>
          ) : (
            <motion.button type="button" onClick={back} whileTap={{ scale: press.scale }} aria-label="Back" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-black/5">
              <Icon name="caretLeft" size={20} />
            </motion.button>
          )}
          {index >= 0 && (
            <div className="flex flex-1 gap-1.5" role="progressbar" aria-label="Gift a basket" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1}>
              {STEPS.map((s, i) => (
                <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/8">
                  <motion.span className="block h-full origin-left rounded-full bg-carbon" initial={false} animate={{ scaleX: i <= index ? 1 : 0 }} transition={spring.smooth} />
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-[min(560px,calc(100%-32px))] pt-4 pb-44">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.section
            key={step}
            custom={dir}
            variants={{ enter: (d: number) => ({ x: 40 * d, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: -40 * d, opacity: 0 }) }}
            initial={still ? false : "enter"}
            animate="center"
            exit="exit"
            transition={spring.smooth}
          >
            {step === "intro" && (
              <div className="pt-4 text-center">
                <motion.div initial={{ y: 20, rotate: -6, opacity: 0 }} animate={{ y: 0, rotate: -3, opacity: 1 }} transition={spring.juicy} className="mx-auto max-w-[360px]">
                  <GiftCard design="berry" amount={15000} to="Mum" from={firstName || "you"} message="So you never run out of fruit." />
                </motion.div>
                <h1 className="mt-9 text-[clamp(2rem,7vw,2.6rem)] leading-[1.04] font-semibold tracking-[-0.045em] text-balance">Gift someone a basket.</h1>
                <p className="mx-auto mt-3 max-w-[24rem] text-[17px] leading-snug text-carbon/65">
                  Fresh fruit and veg for someone in Lagos. They pick what they like, and we bring it to their door.
                </p>
              </div>
            )}

            {step === "who" && (
              <>
                <Q>Who&apos;s it for?</Q>
                <div className="mt-7 space-y-3">
                  <Input label="Their name" value={to} onChange={setTo} placeholder="Mum" autoFocus />
                  <Input
                    label="Their WhatsApp number or email (optional)"
                    value={contact}
                    onChange={setContact}
                    placeholder="0803 123 4567"
                    hint="We'll send it to them the moment it's paid. Or leave it, and share the link yourself."
                  />
                </div>
              </>
            )}

            {step === "size" && (
              <>
                <Q>How big a basket?</Q>
                <div className="mt-7 grid gap-2.5" role="radiogroup" aria-label="Gift value">
                  {GIFT_VALUES.map((v) => {
                    const on = amount === v.amount;
                    return (
                      <motion.button
                        key={v.amount}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          haptic("selection");
                          setAmount(v.amount);
                        }}
                        className={`flex items-center justify-between gap-4 rounded-[22px] p-5 text-left transition-colors ${on ? "bg-carbon text-paper-white" : "bg-black/[0.04] hover:bg-black/[0.07]"}`}
                      >
                        <span>
                          <b className="block text-[17px] font-semibold">{v.label}</b>
                          <span className={`mt-0.5 block text-[14px] ${on ? "text-paper-white/70" : "text-carbon/60"}`}>{v.sub}</span>
                        </span>
                        <span className="text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{formatNaira(v.amount)}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === "note" && (
              <>
                <Q>Add a note</Q>
                <div className="mt-6">
                  <GiftCard design={design} amount={amount} to={to} from={from} message={message || null} />
                </div>
                <div className="mt-5 flex gap-2.5" role="radiogroup" aria-label="Card colour">
                  {GIFT_DESIGNS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={design === d.id}
                      aria-label={d.label}
                      onClick={() => {
                        haptic("selection");
                        setDesign(d.id);
                      }}
                      className={`h-11 flex-1 rounded-full transition-shadow ${design === d.id ? "shadow-[0_0_0_2px_#fff,0_0_0_4px_#000]" : ""}`}
                      style={{ backgroundColor: d.bg, color: d.ink }}
                    >
                      <span className="text-[13px] font-semibold">{d.label}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-5 block">
                  <span className="mb-1.5 block text-[14px] font-medium">Your note (optional)</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="So you never run out of fruit."
                    className="w-full resize-none rounded-[18px] bg-black/[0.04] p-4 text-[16px] leading-relaxed outline-none focus:bg-paper-white focus:shadow-[0_0_0_2px_#000]"
                  />
                </label>
                <Input label="From" value={from} onChange={setFrom} placeholder="Your name" />
              </>
            )}

            {step === "pay" && (
              <>
                <Q>Ready to send?</Q>
                <motion.div initial={{ rotate: -2, scale: 0.96 }} animate={{ rotate: 0, scale: 1 }} transition={spring.juicy} className="mt-6">
                  <GiftCard design={design} amount={amount} to={to} from={from} message={message || null} />
                </motion.div>
                <p className="mt-5 text-[15px] leading-relaxed text-carbon/65">
                  {to} gets a link{contact ? ` by ${contact.includes("@") ? "email" : "WhatsApp"}` : " for you to share"}. They open it, pick their fruit and veg, and we deliver in Lagos. The {formatNaira(amount)} comes off their basket.
                </p>
                <div className="mt-6">
                  {!signedIn ? (
                    <div className="grid gap-2.5">
                      <Link href="/login?next=/gift" className="flex h-14 items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white">
                        Sign in to send it
                      </Link>
                      <p className="text-center text-[13px] text-carbon/55">You need an account to send a gift, so your receipt has somewhere to go.</p>
                    </div>
                  ) : online ? (
                    <PayButton
                      start={() => startGift({ amount, recipientName: to, recipientContact: contact, message, design, fromName: from })}
                      label={`Pay ${formatNaira(amount)} and send`}
                      onPaid={(r) => {
                        if (r.giftCode) router.push(`/gift/${r.giftCode}?sent=1`);
                      }}
                    />
                  ) : (
                    <p className="rounded-[18px] bg-black/[0.04] p-4 text-[15px]">Paying online isn&apos;t available right now, so gifts can&apos;t be sent. Try again soon.</p>
                  )}
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      {step !== "pay" && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-paper-white from-70% to-paper-white/0 pt-6 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-[min(560px,calc(100%-32px))]">
            <motion.button
              type="button"
              onClick={next}
              disabled={!ready[step]}
              whileTap={{ scale: press.scale }}
              transition={spring.snappy}
              className="flex h-14 w-full items-center justify-center rounded-full bg-carbon text-[16px] font-semibold text-paper-white transition-colors disabled:bg-black/[0.07] disabled:text-carbon/60"
            >
              {step === "intro" ? "Choose a gift" : step === "who" && !ready.who ? "Add their name to continue" : step === "note" ? "Looks good" : "Continue"}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}

function Q({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-4 text-[clamp(1.75rem,6vw,2.25rem)] leading-[1.06] font-semibold tracking-[-0.04em] text-balance">{children}</h1>;
}

function Input({ label, value, onChange, placeholder, hint, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; hint?: string; autoFocus?: boolean }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className="h-14 w-full rounded-[18px] bg-black/[0.04] px-4 text-[17px] outline-none focus:bg-paper-white focus:shadow-[0_0_0_2px_#000]"
      />
      {hint && <span className="mt-1.5 block text-[13px] leading-snug text-carbon/55">{hint}</span>}
    </label>
  );
}
