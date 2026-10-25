"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import type { Consent } from "@/lib/analytics";

/**
 * One quiet card, asked once: may we record how the site is used. It sits
 * above the dock for members and above Kachi's launcher for visitors, and
 * never blocks the page.
 */
export function ConsentBanner({ current, onChoose, dockAware }: { current: Consent; onChoose: (c: "granted" | "denied") => void; dockAware: boolean }) {
  return (
    <motion.div
      role="dialog"
      aria-label="Help us improve BasketNG"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.sheet, delay: 0.8 }}
      className={`fixed inset-x-3 z-(--z-overlay) mx-auto max-w-[26rem] rounded-[22px] bg-carbon p-4 text-paper-white shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)] sm:inset-x-auto sm:left-6 ${
        dockAware ? "bottom-[calc(var(--dock-height)+var(--dock-inset)+0.75rem)] lg:bottom-6 lg:left-[calc(15rem+1.5rem)]" : "bottom-[5.5rem] sm:bottom-6"
      }`}
    >
      <p className="text-[15px] font-semibold">Help us make BasketNG better?</p>
      <p className="mt-1 text-[13px] leading-snug text-paper-white/70">
        With your OK we record how you use the site, like taps and scrolling, to fix what&apos;s confusing. Passwords, payments and addresses are never recorded.{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => onChoose("granted")} className="h-10 flex-1 rounded-full bg-mint-pop text-[14px] font-semibold text-carbon active:scale-[0.98]">
          {current === "granted" ? "Keep allowing" : "Allow"}
        </button>
        <button type="button" onClick={() => onChoose("denied")} className="h-10 flex-1 rounded-full bg-paper-white/12 text-[14px] font-semibold active:scale-[0.98]">
          No thanks
        </button>
      </div>
    </motion.div>
  );
}
