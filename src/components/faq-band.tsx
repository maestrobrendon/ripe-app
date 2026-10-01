"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { formatNaira } from "@/lib/format";
import { FREE_DELIVERY_THRESHOLD, BASE_DELIVERY_FEE } from "@/lib/pricing";
import { spring } from "@/lib/motion/tokens";

const FAQS = [
  {
    q: "Where do you deliver?",
    a: (
      <>
        We cover selected Lagos zones, including Lekki, Victoria Island, Ikoyi, Ikeja, Yaba, Surulere
        and Gbagada. Set your delivery area on any page to check if we reach you, or see the full list
        on the{" "}
        <Link href="/delivery-areas" className="underline">
          delivery areas
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    q: "How quickly will my order arrive?",
    a: (
      <>
        Each zone has fixed delivery days, with a 9am to 5pm window. You choose the day that works for
        you at checkout.
      </>
    ),
  },
  {
    q: "Is there a minimum order?",
    a: (
      <>
        No cart minimum. Each product is sold in a set pack size, greens by weight, oranges in pairs, and
        so on, so you add only what you need. Delivery is {formatNaira(BASE_DELIVERY_FEE)}, and free once
        your cart passes {formatNaira(FREE_DELIVERY_THRESHOLD)}.
      </>
    ),
  },
  {
    q: "What if something is not fresh?",
    a: (
      // FOUNDER REVIEW: this used to promise an unconditional refund/replacement,
      // a real liability for fresh produce. Conditioned on the item still being
      // reportable and inspectable; confirm the qualifying window and process
      // before this goes live. See the addendum, Section 11.
      <>
        Every order is quality checked before it leaves us. If an item arrives damaged or not fresh, tell
        us within 24 hours on WhatsApp or by email with a photo of what you received, and we will look
        into it. Depending on what we find, that can mean a replacement, a credit, or a refund for that
        item. It does not cover produce that spoils after a normal amount of time in your kitchen.
      </>
    ),
  },
];

export function FaqBand() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <h2 className="text-heading-lg">Before you order</h2>

      <div className="mt-10 max-w-3xl border-t border-border">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="border-b border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-lg font-semibold"
              >
                {f.q}
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={spring.snappy}
                  className="shrink-0 text-muted"
                >
                  <Plus size={22} aria-hidden />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={spring.smooth}
                    className="overflow-hidden"
                  >
                    <p className="max-w-2xl pb-5 text-base text-muted">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
