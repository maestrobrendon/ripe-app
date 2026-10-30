"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import { findMyArea, locateHelp, type AreaResult } from "@/lib/locate";
import { DELIVERY_WINDOW, daysPhrase } from "@/lib/delivery-labels";
import type { DeliveryDay } from "@/generated/prisma/enums";
import { haptic } from "@/lib/haptics";

export function PinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 18s5.5-5.2 5.5-9.5a5.5 5.5 0 1 0-11 0C4.5 12.8 10 18 10 18Z" />
      <circle cx="10" cy="8.5" r="2" />
    </svg>
  );
}

/**
 * "Do you deliver to me?", answered in place: one button finds the visitor,
 * and the answer replaces it. Yes names their area and days; no takes an
 * email for when we get there; a failure says what to do instead.
 * onResult lets a map beside it show where they are.
 */
export function AreaCheck({
  onResult,
  yes,
  instead = "Find your area in the list.",
  className = "",
}: {
  onResult?: (r: AreaResult) => void;
  /** What to offer once we know we deliver to them, e.g. a "Try a basket" button. */
  yes?: ReactNode;
  /** Where to look when finding them didn't work. */
  instead?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AreaResult | null>(null);
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<"no" | "saving" | "yes" | "error">("no");

  const check = async () => {
    setBusy(true);
    const r = await findMyArea();
    setBusy(false);
    setResult(r);
    haptic(r.kind === "zone" ? "success" : r.kind === "outside" ? "warning" : "error");
    onResult?.(r);
  };

  const notify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (result?.kind !== "outside") return;
    setSaved("saving");
    const where = `${result.at.lat.toFixed(3)},${result.at.lng.toFixed(3)}`;
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, zoneRequested: `near ${where}` }),
    }).catch(() => null);
    setSaved(res?.ok ? "yes" : "error");
  };

  return (
    <div className={className} aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {result?.kind === "zone" ? (
          <motion.div key="yes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.smooth} className="rounded-[22px] bg-[#e6f7ee] p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint-pop">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold tracking-[-0.02em]">Yes, we deliver to you.</p>
                <p className="mt-1 text-[15px] leading-snug text-carbon/70">
                  You&apos;re in <b className="font-semibold text-carbon">{result.zone.name}</b>. {daysPhrase(result.zone.deliveryDays as DeliveryDay[])}, {DELIVERY_WINDOW}.
                </p>
              </div>
            </div>
            {yes && <div className="mt-4">{yes}</div>}
          </motion.div>
        ) : result?.kind === "outside" ? (
          <motion.div key="no" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.smooth} className="rounded-[22px] bg-[#fff3e8] p-5">
            <p className="text-[17px] font-semibold tracking-[-0.02em]">Not your area yet.</p>
            {saved === "yes" ? (
              <p className="mt-1 text-[15px] text-carbon/70">Thanks. We&apos;ll email you when we reach you.</p>
            ) : (
              <>
                <p className="mt-1 text-[15px] leading-snug text-carbon/70">Leave your email and we&apos;ll tell you when we reach you.</p>
                <form onSubmit={notify} className="mt-3 flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Your email"
                    className="h-12 min-w-0 flex-1 rounded-full bg-paper-white px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-carbon"
                  />
                  <button type="submit" disabled={saved === "saving"} className="h-12 shrink-0 rounded-full bg-carbon px-5 text-[15px] font-semibold text-paper-white disabled:opacity-60">
                    Notify me
                  </button>
                </form>
                {saved === "error" && <p className="mt-2 text-[13px] text-ember">That didn&apos;t go through. Check the email and try again.</p>}
              </>
            )}
            <button type="button" onClick={() => setResult(null)} className="mt-3 text-[14px] font-semibold underline decoration-carbon/25 underline-offset-4">
              Check again
            </button>
          </motion.div>
        ) : (
          <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              type="button"
              onClick={check}
              disabled={busy}
              className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-carbon px-6 text-[15px] font-semibold text-paper-white transition-transform active:scale-[0.98] disabled:opacity-70 sm:w-auto"
            >
              <PinIcon className={`h-5 w-5 ${busy ? "animate-pulse" : ""}`} />
              {busy ? "Finding you…" : "Check my address"}
            </button>
            {result?.kind === "failed" && (
              <p role="status" className="mt-3 text-[14px] leading-snug text-carbon/70">
                {locateHelp(result.reason, instead)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
