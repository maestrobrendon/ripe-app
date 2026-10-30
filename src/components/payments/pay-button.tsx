"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPayment } from "@/lib/payment-actions";
import type { Settled, StartResult } from "@/lib/payments";
import { haptic } from "@/lib/haptics";

type Phase = "idle" | "opening" | "paying" | "checking" | "done" | "error";

/**
 * "Pay ₦X now": opens Paystack's checkout over the page (card, bank, USSD or
 * transfer), then has the server confirm the payment with Paystack before
 * anything shows as paid. If the checkout can't open in the page, the
 * customer goes to Paystack's own page and comes back to the same place.
 *
 * `start` is a server action that opens the payment for this order or plan;
 * the amount is always the server's.
 */
export function PayButton({
  start,
  label,
  onPaid,
  autoStart = false,
  className = "",
  note = true,
  tone = "dark",
}: {
  start: () => Promise<StartResult>;
  label: string;
  onPaid?: (r: Extract<Settled, { ok: true }>) => void;
  /** Open the checkout as soon as the button appears (after choosing "Pay now" at checkout). */
  autoStart?: boolean;
  className?: string;
  /** The small "secured by Paystack" line under the button. */
  note?: boolean;
  /** "light" on a dark card. */
  tone?: "dark" | "light";
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const check = async (reference: string) => {
    setPhase("checking");
    // A transfer or USSD payment can take a moment to land: check a few times.
    for (let i = 0; i < 6; i++) {
      const r = await confirmPayment(reference);
      if (r.ok) {
        setPhase("done");
        setMessage(null);
        haptic("success");
        onPaid?.(r);
        router.refresh();
        return;
      }
      if (r.status !== "PENDING") {
        setPhase("error");
        setMessage(r.message);
        haptic("error");
        return;
      }
      await new Promise((ok) => setTimeout(ok, 2500));
    }
    setPhase("error");
    setMessage("Your bank is still confirming the payment. It will show here as paid once it does; there's no need to pay again.");
  };

  const pay = async () => {
    if (phase === "opening" || phase === "paying" || phase === "checking") return;
    setMessage(null);
    setPhase("opening");
    const s = await start();
    if (!s.ok) {
      setPhase("error");
      setMessage(s.error);
      haptic("error");
      return;
    }
    try {
      const PaystackPop = (await import("@paystack/inline-js")).default;
      setPhase("paying");
      new PaystackPop().resumeTransaction(s.accessCode, {
        onSuccess: (t) => void check(t.reference || s.reference),
        onCancel: () => {
          setPhase("idle");
          setMessage("Payment cancelled. Nothing was charged.");
        },
        onError: () => window.location.assign(s.authorizationUrl),
      });
    } catch {
      // The checkout couldn't load in the page: use Paystack's own page instead.
      window.location.assign(s.authorizationUrl);
    }
  };

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void pay();
    // Once, when the button first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  if (phase === "done") {
    return (
      <p role="status" className="flex items-center gap-2 rounded-[18px] bg-[#e6f7ee] px-4 py-3 text-[15px] font-semibold text-[#0f7a48]">
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0" aria-hidden>
          <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Paid. Thank you. Your receipt is on its way by email.
      </p>
    );
  }

  const busy = phase === "opening" || phase === "paying" || phase === "checking";
  return (
    <div className={className}>
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className={`inline-flex h-13 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-70 ${tone === "light" ? "bg-paper-white text-carbon" : "bg-carbon text-paper-white"}`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
          <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" />
          <path d="M2.5 8.5h15M6 12.5h3" />
        </svg>
        {phase === "opening" ? "Opening…" : phase === "paying" ? "Finish in the payment window…" : phase === "checking" ? "Confirming your payment…" : label}
      </button>
      {message && (
        <p role="status" className={`mt-2.5 text-center text-[13px] leading-snug ${tone === "light" ? "text-paper-white/75" : "text-carbon/70"}`}>
          {message}
        </p>
      )}
      {note && !message && <p className={`mt-2 text-center text-[12px] ${tone === "light" ? "text-paper-white/60" : "text-carbon/50"}`}>Card, bank transfer or USSD · secured by Paystack</p>}
    </div>
  );
}
