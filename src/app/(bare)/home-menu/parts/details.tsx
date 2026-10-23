"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { spring } from "@/lib/motion/tokens";
import { Reveal, scrollToY } from "../../home-next/parts/runtime";
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

/** On phones the little demo stays out: each detail is a title and a line, in a list. */
function Detail({ title, body, color, children }: { title: string; body: string; color: string; children: ReactNode }) {
  return (
    <Reveal className="border-t border-[var(--hm-line)] pt-5 md:border-0 md:pt-0">
      <div className="hm-panel hidden h-[200px] place-items-center overflow-hidden p-6 md:grid">{children}</div>
      <h3 className={`text-[15px] font-semibold md:mt-5 ${color}`}>{title}</h3>
      <p className="mt-1.5 max-w-[30rem] text-[16px] leading-relaxed text-carbon/80 md:text-[17px]">{body}</p>
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
        <span className="text-[var(--hm-ink-3)]">Change it until the evening before</span>
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

const DOW: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

function weekLabels(day: string) {
  const d = new Date();
  // The next four delivery days, as the weeks a customer would see.
  const dow = DOW[day] ?? 5;
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7));
  return Array.from({ length: 4 }, (_, i) => {
    const w = new Date(d);
    w.setDate(d.getDate() + i * 7);
    return w.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  });
}

function SkipWidget({ day }: { day: string }) {
  const { ref, i } = useLoop(2, 2400);
  // Dates are filled in after mount, so the server and the browser agree on first paint.
  const [weeks, setWeeks] = useState(["Week 1", "Week 2", "Week 3", "Week 4"]);
  useEffect(() => {
    const t = setTimeout(() => setWeeks(weekLabels(day)), 0);
    return () => clearTimeout(t);
  }, [day]);
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
            <span className={`text-[11px] font-semibold ${skipped ? "text-[var(--hm-ink-3)]" : ""}`}>{skipped ? "Skipped" : "Confirmed"}</span>
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

const FACTS = ["Your day, every week", "Change it until the night before", "Pay when it arrives"];

/** The four points, in the order they play. */
const DETAILS: { title: string; color: string; body: string; widget: (day: string) => ReactNode }[] = [
  {
    title: "A reminder before every delivery",
    color: "text-[#0f7a48]",
    body: "Your basket stays as you left it. A few days before your day we remind you to confirm it, and you can change anything until the evening before.",
    widget: () => <EditWidget />,
  },
  {
    title: "Skip a week when you're away",
    color: "text-electric-blue",
    body: "Travelling, or still working through last week's? Skip it and nothing comes. Nothing is ever charged automatically.",
    widget: (day) => <SkipWidget day={day} />,
  },
  {
    title: "Checked by hand before it leaves",
    color: "text-ember",
    body: "Every order is looked over before it goes out. Anything bruised gets swapped, not shipped.",
    widget: () => <CheckWidget />,
  },
  {
    title: "Your first basket is a trial",
    color: "text-voltage-violet",
    body: "Try one delivery at market prices, no membership needed. Join to have your baskets every week, at member prices.",
    widget: () => <TrialWidget />,
  },
];

/** Fills with scroll across its own quarter of the section. */
function PointBar({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const fill = useTransform(progress, (p) => Math.min(1, Math.max(0, p * DETAILS.length - index)));
  return (
    <span className="block h-1 overflow-hidden rounded-full bg-carbon/10">
      <motion.span style={{ scaleX: fill }} className="block h-full origin-left rounded-full bg-carbon" />
    </span>
  );
}

/**
 * From laptops up the section is tall and the stage sticks under the header,
 * so the reader's own scroll plays the four points one after another: each
 * one's bar fills, and its demo and words take the panel. Tapping a bar
 * scrolls to that point. On phones and tablets, and with reduced motion, the
 * points are a plain list.
 */
export function Details({ deliveryDay }: { deliveryDay: string }) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const stepped = !reduced;
  const [frame, setFrame] = useState(0);
  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => setFrame(Math.min(DETAILS.length - 1, Math.max(0, Math.floor(p * DETAILS.length)))));

  const pick = (i: number) => {
    const el = root.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const range = el.offsetHeight - window.innerHeight;
    scrollToY(top + range * ((i + 0.08) / DETAILS.length));
  };

  const current = DETAILS[frame];

  return (
    <section ref={root} id="details" className={`py-12 sm:py-24 ${stepped ? "lg:h-[360svh] lg:py-0" : ""}`}>
      <div className={`hm-wrap grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 ${stepped ? "lg:sticky lg:top-[72px] lg:h-[calc(100svh-72px)] lg:items-center" : ""}`}>
        <div>
          <div className={stepped ? "" : "lg:sticky lg:top-28"}>
            <Eyebrow className="text-[#0f7a48]">Fresh to your door</Eyebrow>
            <h2 className="hm-h2">What arrives.</h2>
            <p className="hm-lede mt-4 max-w-[26rem]">Picked ripe, checked by hand, at your door on your day.</p>
            {/* The three facts a first visit needs; the cards beside go deeper. */}
            <ul className="mt-6 flex flex-col gap-2.5 text-[16px] font-medium">
              {FACTS.map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-pop">
                    <Check className="h-3 w-3" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
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
        {/* The list: phones and tablets, and every width with reduced motion. */}
        <div className={`grid gap-5 md:gap-14 ${stepped ? "lg:hidden" : ""}`}>
          {DETAILS.map((d) => (
            <Detail key={d.title} title={d.title} color={d.color} body={d.body}>
              {d.widget(deliveryDay)}
            </Detail>
          ))}
        </div>

        {/* The stage: one point at a time, as you scroll. */}
        {stepped && (
          <div className="hidden lg:flex lg:flex-col lg:gap-5">
            <div className="flex items-center gap-5">
              <div className="grid flex-1 grid-cols-4 gap-2" role="tablist" aria-label="What arrives">
                {DETAILS.map((d, i) => (
                  <button key={d.title} type="button" role="tab" aria-selected={i === frame} aria-label={d.title} onClick={() => pick(i)} className="py-2">
                    <PointBar index={i} progress={scrollYProgress} />
                  </button>
                ))}
              </div>
              <span className="text-[13px] font-semibold text-[var(--hm-ink-3)] tabular-nums">
                0{frame + 1} / 0{DETAILS.length}
              </span>
            </div>
            <div className="hm-panel grid h-[min(400px,46svh)] place-items-center overflow-hidden p-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={frame}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="grid w-full place-items-center"
                >
                  {/* The demos are drawn at card size; the stage has room for a little more. */}
                  <div className="grid w-full scale-[1.15] place-items-center">{current.widget(deliveryDay)}</div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="min-h-[6.5rem]" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={frame} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                  <h3 className={`text-[15px] font-semibold ${current.color}`}>{current.title}</h3>
                  <p className="mt-1.5 max-w-[30rem] text-[17px] leading-relaxed text-carbon/80">{current.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
