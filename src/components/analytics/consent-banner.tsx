"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";
import type { Consent } from "@/lib/analytics";

/**
 * The cookie banner: one card, asked once, never blocking the page. Accept
 * all, Reject optional, or Settings, which opens the two categories
 * (essential, always on; analytics, a switch). It sits above the dock for
 * members and above Kachi's launcher for visitors.
 */
export function ConsentBanner({
  current,
  onChoose,
  dockAware,
  startInSettings = false,
}: {
  current: Consent;
  onChoose: (c: "granted" | "denied") => void;
  dockAware: boolean;
  startInSettings?: boolean;
}) {
  const [settings, setSettings] = useState(startInSettings);
  const [analytics, setAnalytics] = useState(current === "granted");

  return (
    <motion.div
      role="dialog"
      aria-label="Cookies"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.sheet, delay: startInSettings ? 0 : 0.8 }}
      className={`fixed inset-x-3 z-(--z-overlay) mx-auto max-w-[26rem] rounded-[22px] bg-carbon p-4 text-paper-white shadow-[0_24px_48px_-20px_rgb(0_0_0/0.6)] sm:inset-x-auto sm:left-6 ${
        dockAware ? "bottom-[calc(var(--dock-height)+var(--dock-inset)+0.75rem)] lg:bottom-6 lg:left-[calc(15rem+1.5rem)]" : "bottom-[5.5rem] sm:bottom-6"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!settings ? (
          <motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <p className="text-[15px] font-semibold">We use cookies</p>
            <p className="mt-1 text-[13px] leading-snug text-paper-white/70">
              Essential cookies keep you signed in and remember your basket. With your OK, analytics cookies help us see how the site is used so we can improve it.{" "}
              <Link href="/cookies" className="underline underline-offset-2">
                Cookie policy
              </Link>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onChoose("granted")} className="col-span-2 h-10 rounded-full bg-mint-pop text-[14px] font-semibold text-carbon active:scale-[0.98]">
                Accept all
              </button>
              <button type="button" onClick={() => onChoose("denied")} className="h-10 rounded-full bg-paper-white/12 text-[14px] font-semibold active:scale-[0.98]">
                Reject optional
              </button>
              <button type="button" onClick={() => setSettings(true)} className="h-10 rounded-full bg-paper-white/12 text-[14px] font-semibold active:scale-[0.98]">
                Settings
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <p className="text-[15px] font-semibold">Cookie settings</p>
            <ul className="mt-3 divide-y divide-paper-white/10 rounded-2xl bg-paper-white/[0.06]">
              <li className="flex items-start gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px] font-semibold">Essential</b>
                  <small className="block text-[12px] leading-snug text-paper-white/60">Sign-in, your basket and delivery area. The site can&apos;t work without them.</small>
                </span>
                <span className="mt-0.5 shrink-0 text-[12px] font-semibold text-paper-white/50">Always on</span>
              </li>
              <li className="flex items-start gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <b className="block text-[14px] font-semibold">Analytics</b>
                  <small className="block text-[12px] leading-snug text-paper-white/60">Remember your device between visits and record how you use the site, like taps and scrolling. Typed details are never recorded.</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analytics}
                  aria-label="Analytics cookies"
                  onClick={() => setAnalytics((a) => !a)}
                  className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${analytics ? "bg-mint-pop" : "bg-paper-white/25"}`}
                >
                  <motion.span layout transition={spring.snappy} className={`absolute top-1 h-5 w-5 rounded-full bg-paper-white ${analytics ? "right-1" : "left-1"}`} />
                </button>
              </li>
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onChoose(analytics ? "granted" : "denied")} className="col-span-2 h-10 rounded-full bg-mint-pop text-[14px] font-semibold text-carbon active:scale-[0.98]">
                Save choices
              </button>
              <Link href="/cookies" className="col-span-2 text-center text-[12px] text-paper-white/60 underline underline-offset-2">
                Read the cookie policy
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
