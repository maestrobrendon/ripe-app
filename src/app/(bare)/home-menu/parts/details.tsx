"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { spring } from "@/lib/motion/tokens";
import { Reveal } from "../../home-next/parts/runtime";
import { Check, Eyebrow } from "./shared";

/** Ticks through `n` states on a loop while the widget is on screen. */
function useLoop(n: number, every: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView || reduced) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), every);
    return () => clearInterval(t);
  }, [inView, reduced, n, every]);
  return { ref, i: reduced ? n - 1 : i };
}

function Detail({ title, body, color, children }: { title: string; body: string; color: string; children: ReactNode }) {
  return (
    <Reveal>
      <div className="hm-panel grid h-[200px] place-items-center overflow-hidden p-6">{children}</div>
      <h3 className={`mt-5 text-[15px] font-semibold ${color}`}>{title}</h3>
      <p className="mt-1.5 max-w-[30rem] text-[17px] leading-relaxed text-carbon/80">{body}</p>
    </Reveal>
  );
}

function EditWidget() {
  const { ref, i } = useLoop(2, 2200);
  const qty = i === 0 ? 2 : 3;
  return (
    <div ref={ref} className="w-full max-w-[300px] rounded-[18px] bg-paper-white p-4 shadow-[0_1px_0_var(--hm-line)]">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-semibold">Avocado</span>
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f3f5f0]">−</span>
          <span className="relative h-5 w-4 overflow-hidden text-center font-semibold tabular-nums">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span key={qty} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={spring.number} className="absolute inset-0">
                {qty}
              </motion.span>
            </AnimatePresence>
          </span>
          <motion.span animate={{ scale: i === 1 ? [1, 0.88, 1] : 1 }} transition={{ duration: 0.3 }} className="grid h-7 w-7 place-items-center rounded-full bg-carbon text-paper-white">
            +
          </motion.span>
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--hm-line)] pt-3 text-[13px]">
        <span className="text-[var(--hm-ink-3)]">Edits close the night before</span>
        <AnimatePresence>
          {i === 1 && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring.juicy} className="inline-flex items-center gap-1 font-semibold text-[#0f7a48]">
              <Check className="h-3.5 w-3.5" /> Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function weekLabels() {
  const d = new Date();
  // The next four Wednesdays, as the delivery weeks a customer would see.
  d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7));
  return Array.from({ length: 4 }, (_, i) => {
    const w = new Date(d);
    w.setDate(d.getDate() + i * 7);
    return w.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  });
}

function SkipWidget() {
  const { ref, i } = useLoop(2, 2400);
  // Dates are filled in after mount, so the server and the browser agree on first paint.
  const [weeks, setWeeks] = useState(["Week 1", "Week 2", "Week 3", "Week 4"]);
  useEffect(() => {
    const t = setTimeout(() => setWeeks(weekLabels()), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <div ref={ref} className="grid w-full max-w-[340px] grid-cols-4 gap-2">
      {weeks.map((w, k) => {
        const skipped = k === 2 && i === 1;
        return (
          <motion.div
            key={k}
            animate={{ backgroundColor: skipped ? "rgba(255,255,255,0.5)" : "#ffffff", scale: k === 2 && i === 1 ? [1, 0.95, 1] : 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-2 rounded-[16px] px-1 py-3 shadow-[0_1px_0_var(--hm-line)]"
          >
            <span className="text-[12px] font-semibold text-[var(--hm-ink-3)]">{w}</span>
            <motion.span
              animate={{ backgroundColor: skipped ? "rgba(0,0,0,0)" : "var(--mint-pop)", borderColor: skipped ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0)" }}
              className="grid h-7 w-7 place-items-center rounded-full border-[1.5px]"
            >
              {!skipped && <Check className="h-3.5 w-3.5" />}
            </motion.span>
            <span className={`text-[11px] font-semibold ${skipped ? "text-[var(--hm-ink-3)]" : ""}`}>{skipped ? "Skipped" : "Basket"}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

const CHECKS = ["Firm and fresh", "Ripe on time for your recipes", "Anything bruised gets swapped"];

function CheckWidget() {
  const { ref, i } = useLoop(CHECKS.length + 1, 900);
  return (
    <div ref={ref} className="w-full max-w-[300px] space-y-2">
      {CHECKS.map((c, k) => {
        const on = i > k;
        return (
          <div key={c} className="flex items-center gap-3 rounded-[14px] bg-paper-white px-3.5 py-2.5 text-[14px] shadow-[0_1px_0_var(--hm-line)]">
            <motion.span
              animate={{ backgroundColor: on ? "var(--mint-pop)" : "rgba(0,0,0,0.07)", scale: on ? [0.7, 1.12, 1] : 1 }}
              transition={{ duration: 0.35 }}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
            >
              {on && <Check className="h-3 w-3" />}
            </motion.span>
            <span className={on ? "font-semibold" : "text-[var(--hm-ink-3)]"}>{c}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrialWidget() {
  const rows: [string, string][] = [
    ["Membership", "None"],
    ["Card kept on file", "No"],
    ["Renews on its own", "Never"],
  ];
  return (
    <div className="w-full max-w-[300px] rounded-[18px] bg-paper-white p-4 text-[14px] shadow-[0_1px_0_var(--hm-line)]">
      <p className="font-semibold">Your first basket</p>
      <div className="mt-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-dashed border-[var(--hm-line)] py-2 last:border-0">
            <span className="text-[var(--hm-ink-2)]">{k}</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Details() {
  return (
    <section id="details" className="py-16 sm:py-24">
      <div className="hm-wrap grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <div className="lg:sticky lg:top-28">
            <Eyebrow className="text-[#0f7a48]">Fresh to your door</Eyebrow>
            <h2 className="hm-h2">The fresh produce behind every recipe.</h2>
            <p className="hm-lede mt-4 max-w-[26rem]">
              Picked ripe, checked by hand and brought to your door on your day. And it bends around your week, right up to the night before.
            </p>
            {/* The basket arriving, then unpacked at home: the produce is the
                product, the recipes are what it turns into. */}
            <Reveal className="relative mt-8 pb-[12%] lg:max-w-[460px]">
              <figure className="hm-photo relative aspect-[5/4] w-[82%] overflow-hidden rounded-[28px] bg-[#f3f5f0]">
                <Image
                  src="/images/home/fresh-doorstep.jpg"
                  alt="A rider hands a basket of fresh fruit and vegetables to a woman at her front door"
                  fill
                  sizes="(min-width: 1024px) 380px, 82vw"
                  className="object-cover"
                />
              </figure>
              <figure className="hm-photo absolute right-0 bottom-0 aspect-square w-[46%] overflow-hidden rounded-[22px] bg-[#f3f5f0] shadow-[0_0_0_6px_var(--paper-white),0_24px_40px_-24px_rgb(0_0_0/0.35)]">
                <Image
                  src="/images/home/fresh-kitchen.jpg"
                  alt="Pineapple, mangoes, plantain and greens being unpacked on a kitchen counter"
                  fill
                  sizes="(min-width: 1024px) 220px, 46vw"
                  className="object-cover"
                />
              </figure>
              <span className="absolute top-4 left-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-paper-white/92 px-3.5 text-[13px] font-semibold backdrop-blur-sm">
                <Check className="h-4 w-4 text-[#0f7a48]" />
                Delivered on your day
              </span>
            </Reveal>
          </div>
        </div>
        <div className="grid gap-14">
          <Detail title="Change it until the night before" color="text-[#0f7a48]" body="Add, remove or swap anything in your basket. Whatever it says the night before is what we pack.">
            <EditWidget />
          </Detail>
          <Detail title="Skip a week when you're away" color="text-electric-blue" body="Travelling, or still working through last week's? Skip it and nothing comes, and nothing is charged.">
            <SkipWidget />
          </Detail>
          <Detail title="Checked by hand before it leaves" color="text-ember" body="Every order is looked over before it goes out. Anything bruised gets swapped, not shipped.">
            <CheckWidget />
          </Detail>
          <Detail title="Try one basket, no strings" color="text-voltage-violet" body="Your first basket is a one-off at standard prices. Become a member later if you want every basket after it to cost less.">
            <TrialWidget />
          </Detail>
        </div>
      </div>
    </section>
  );
}
