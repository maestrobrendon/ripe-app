"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";

/**
 * The one decision after sign-up, as two clear paths: confirm the first
 * basket now (and choose to pay when it arrives or now by transfer, at
 * checkout), or keep it for later on Home. Nothing is decided for them.
 */
export function WelcomeChoice({ canConfirm, checkoutHref, areaName }: { canConfirm: boolean; checkoutHref: string; areaName: string | null }) {
  const rise = (i: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { ...spring.smooth, delay: 0.45 + i * 0.08 } });
  return (
    <div className="mt-8 grid gap-3">
      {canConfirm && (
        <motion.div {...rise(0)}>
          <Link
            href={checkoutHref}
            onClick={() => haptic("light")}
            className="group flex items-center gap-4 rounded-[22px] bg-carbon p-5 text-paper-white transition-transform active:scale-[0.985]"
          >
            <span className="min-w-0 flex-1">
              <b className="block text-[18px] font-semibold">Confirm it now</b>
              <span className="mt-1 block text-[14px] leading-snug text-paper-white/70">Then pay in a minute, by card, transfer or USSD.</span>
            </span>
            <Icon name="caretRight" size={20} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      )}
      <motion.div {...rise(canConfirm ? 1 : 0)}>
        <Link
          href="/basket"
          onClick={() => haptic("selection")}
          className="group flex items-center gap-4 rounded-[22px] bg-(--hm-tint-2) p-5 transition-transform active:scale-[0.985]"
        >
          <span className="min-w-0 flex-1">
            <b className="block text-[18px] font-semibold">{canConfirm ? "Keep it for later" : "Go to my basket"}</b>
            <span className="mt-1 block text-[14px] leading-snug text-(--hm-ink-2)">
              {canConfirm
                ? "It stays saved on Home. Change anything, and confirm when you're ready."
                : areaName
                  ? `We don't deliver to ${areaName} yet. Your basket is saved, and we'll tell you when we do.`
                  : "Add your address there, and see the days we come to you."}
            </span>
          </span>
          <Icon name="caretRight" size={20} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </div>
  );
}
