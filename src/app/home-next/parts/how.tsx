"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { CaretDown, Check, Moped, HouseLine, Basket as BasketIcon } from "@phosphor-icons/react";
import { spring } from "@/lib/motion/tokens";
import { ProduceSticker } from "./produce";
import { scrollToY } from "./runtime";
import type { ShowcaseGoal } from "../types";

const STEPS = [
  {
    tab: "Set it",
    title: "Set it once.",
    body: "Name your basket, choose what goes in, pick the day it comes. A training week for you, a full table for the family. Your call.",
  },
  {
    tab: "We pick it",
    title: "We pick it the day before.",
    body: "Picked at the farm, then looked over by a person before it leaves. Anything that is not right gets replaced, not shipped.",
  },
  {
    tab: "It arrives",
    title: "It arrives. Every week.",
    body: "Same day, same window, no reminders. Change what is inside until the night before, or skip a week when you are away.",
  },
];

/**
 * Three steps, one phone, driven by scroll. The section is tall and its stage
 * sticks under the header, so scrolling fills each step's bar and the phone
 * moves on as each one completes. Tapping a step scrolls to it. With reduced
 * motion the stage does not stick and the steps are plain tabs.
 */
export function How({ goal, deliveryDay }: { goal: ShowcaseGoal; deliveryDay: string }) {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [screen, setScreen] = useState(0);
  const { scrollYProgress } = useScroll({ target: root, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (!reduced) setScreen(Math.min(STEPS.length - 1, Math.max(0, Math.floor(p * STEPS.length))));
  });

  const pick = (i: number) => {
    const el = root.current;
    if (reduced || !el) return setScreen(i);
    const top = el.getBoundingClientRect().top + window.scrollY;
    const range = el.offsetHeight - window.innerHeight;
    scrollToY(top + range * ((i + 0.08) / STEPS.length));
  };

  return (
    <section
      ref={root}
      id="how"
      className="relative bg-paper-white"
      style={{ height: reduced ? undefined : `${STEPS.length * 95}svh` }}
    >
      <div
        className={`mx-auto flex w-[min(1180px,calc(100%-32px))] flex-col sm:w-[min(1180px,calc(100%-48px))] lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-20 ${
          reduced ? "py-20" : "sticky top-16 h-[calc(100svh-4rem)] pt-6 pb-5 lg:py-0"
        }`}
      >
        <div>
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
            <i className="h-2.5 w-2.5 rounded-full border border-carbon bg-electric-blue" aria-hidden />
            How it works
          </span>
          <h2 className="hn-display mt-3 text-[clamp(1.9rem,4.6vw,4.2rem)] lg:mt-5">Set it once. We handle the week.</h2>

          {/* Phones: three tabs in a row, the active step's words under them. */}
          <div className="mt-5 grid grid-cols-3 gap-2 lg:hidden" role="tablist" aria-label="Steps">
            {STEPS.map((s, i) => (
              <button key={s.tab} type="button" role="tab" aria-selected={i === screen} onClick={() => pick(i)} className="text-left">
                <StepBar index={i} progress={scrollYProgress} reduced={Boolean(reduced)} active={i === screen} />
                <span className={`mt-2 block text-[13px] font-semibold transition-opacity ${i === screen ? "opacity-100" : "opacity-45"}`}>
                  <span className="tabular-nums">0{i + 1}</span> {s.tab}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 min-h-27 lg:hidden" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={screen}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <h3 className="text-xl font-semibold tracking-[-0.03em]">{STEPS[screen].title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-carbon/75">{STEPS[screen].body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Desktop: the steps as a list; the active one opens up. */}
          <div className="mt-10 hidden border-t border-carbon lg:block" role="tablist" aria-label="Steps">
            {STEPS.map((s, i) => {
              const on = i === screen;
              return (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => pick(i)}
                  className="group block w-full border-b border-carbon py-5 text-left"
                >
                  <span className="flex items-baseline gap-4">
                    <span className="text-sm font-semibold text-carbon/50 tabular-nums">0{i + 1}</span>
                    <span
                      className={`text-[clamp(1.4rem,2vw,1.75rem)] font-semibold tracking-[-0.03em] transition-opacity ${
                        on ? "" : "opacity-40 group-hover:opacity-70"
                      }`}
                    >
                      {s.title}
                    </span>
                  </span>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.span
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={spring.smooth}
                        className="block overflow-hidden"
                      >
                        <span className="block max-w-md pt-2 pl-9 text-base leading-relaxed text-carbon/75">{s.body}</span>
                        {!reduced && (
                          <span className="mt-4 block pl-9">
                            <StepBar index={i} progress={scrollYProgress} reduced={false} active />
                          </span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>
        </div>

        <ScaledPhone>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-5 top-7 bottom-6"
            >
              <Screen index={screen} active goal={goal} deliveryDay={deliveryDay} />
            </motion.div>
          </AnimatePresence>
        </ScaledPhone>
      </div>
    </section>
  );
}

/** Fills with scroll across its own third of the section. */
function StepBar({ index, progress, reduced, active }: { index: number; progress: MotionValue<number>; reduced: boolean; active: boolean }) {
  const fill = useTransform(progress, (p) => Math.min(1, Math.max(0, p * STEPS.length - index)));
  return (
    <span className="block h-1 overflow-hidden rounded-full bg-soft-mist">
      <motion.span
        style={{ scaleX: reduced ? (active ? 1 : 0) : fill }}
        className="block h-full origin-left bg-carbon"
      />
    </span>
  );
}

const PHONE_W = 300;
const PHONE_H = 540;

/**
 * The phone is drawn at one fixed size and scaled to whatever height the
 * sticky stage has left, so it always fits on screen, from a small phone to a
 * large monitor, without its contents reflowing.
 */
function ScaledPhone({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      if (h > 0) setScale(Math.min(1.12, h / PHONE_H));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="relative mt-3 flex min-h-0 flex-1 justify-center lg:mt-0 lg:h-[min(640px,78svh)] lg:flex-none">
      <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }} className="relative shrink-0">
        <div
          className="absolute top-0 left-0 origin-top-left overflow-hidden rounded-[44px] border-[10px] border-carbon bg-paper-white"
          style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}
        >
          <div className="absolute top-2 left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-carbon" aria-hidden />
          {children}
        </div>
      </div>
    </div>
  );
}

function Screen({ index, active, goal, deliveryDay }: { index: number; active: boolean; goal: ShowcaseGoal; deliveryDay: string }) {
  const items = goal.picks.slice(0, 4);

  if (index === 0) {
    return (
      <div className="text-sm">
        <Top title="Basket" pill={<><BasketIcon weight="bold" className="h-3.5 w-3.5" /> Cart</>} />
        <p className="mt-7 flex items-center gap-1 text-2xl font-semibold tracking-[-0.03em]">
          {goal.title} <CaretDown weight="bold" className="h-4 w-4" />
        </p>
        <div className="mt-3 rounded-2xl border border-carbon bg-mint-pop/25 px-3.5 py-3">
          <b className="block font-semibold">Comes every {deliveryDay}</b>
          <small className="text-carbon/65">Change what is inside until the night before</small>
        </div>
        {items.map((p, i) => (
          <motion.div
            key={p.productId}
            initial={{ opacity: 0, x: 16 }}
            animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
            transition={{ ...spring.smooth, delay: 0.1 + i * 0.07 }}
            className="flex items-center gap-2.5 border-b border-soft-mist py-2.5"
          >
            <ProduceSticker name={p.name} publicId={p.cloudinaryPublicId} emoji={p.imageEmoji} rounded="rounded-[10px]" className="h-9 w-9 shrink-0" emojiClassName="text-xl" sizes="40px" />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto font-semibold tabular-nums">{p.quantity}</span>
          </motion.div>
        ))}
        <div className="mt-4 grid h-11 place-items-center rounded-full bg-carbon font-semibold text-paper-white">Save basket</div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="text-sm">
        <Top title="Picking" pill="The day before" />
        <p className="mt-7 text-xl font-semibold tracking-[-0.03em]">
          {goal.title}, for {deliveryDay}
        </p>
        {items.map((p, i) => (
          <div key={p.productId} className="flex items-center gap-2.5 border-b border-soft-mist py-2.5">
            <ProduceSticker name={p.name} publicId={p.cloudinaryPublicId} emoji={p.imageEmoji} rounded="rounded-[10px]" className="h-9 w-9 shrink-0" emojiClassName="text-xl" sizes="40px" />
            <span className="truncate">{p.name}</span>
            <span className="relative ml-auto grid h-5.5 w-5.5 place-items-center rounded-full border border-carbon">
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={active ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                transition={{ ...spring.juicy, delay: 0.4 + i * 0.35 }}
                className="absolute inset-0 grid place-items-center rounded-full bg-mint-pop"
              >
                <Check weight="bold" className="h-3 w-3" />
              </motion.span>
            </span>
          </div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ ...spring.smooth, delay: 0.4 + items.length * 0.35 }}
          className="mt-4 rounded-2xl border border-carbon p-3.5"
        >
          <h5 className="font-semibold">Checked by hand</h5>
          <small className="text-[13px] text-carbon/65">
            {items[1] ? `One ${items[1].name.toLowerCase()} swapped for a riper one.` : "Everything looked right."}
          </small>
        </motion.div>
      </div>
    );
  }

  const labels = ["Received", "Picked", "On the way", "Delivered"];
  return (
    <div className="text-sm">
      <Top
        title={deliveryDay}
        pill={
          <>
            <span className="relative flex h-2 w-2">
              <span className="hn-ping absolute inset-0 rounded-full bg-ember" />
              <span className="relative h-2 w-2 rounded-full bg-ember" />
            </span>
            On the way
          </>
        }
      />
      <div className="mt-4 rounded-2xl border border-carbon p-3.5">
        <h5 className="font-semibold">{goal.title}, arriving by 5pm</h5>
        <div className="mt-3 flex gap-1.5">
          {labels.map((l, i) => (
            <span key={l} className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft-mist">
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: active && i < 3 ? 1 : 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.25 }}
                className="block h-full origin-left bg-carbon"
              />
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-carbon/65">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
      <div className="relative mt-3.5 h-36 overflow-hidden rounded-2xl border border-carbon bg-sky-wash">
        <div className="absolute inset-x-[10%] top-1/2 h-1 -translate-y-1/2 rounded bg-paper-white" />
        <motion.span
          initial={{ left: "8%" }}
          animate={{ left: active ? "68%" : "8%" }}
          transition={{ duration: 2.4, ease: [0.65, 0, 0.35, 1], delay: 0.5 }}
          className="absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-carbon bg-sunburst"
        >
          <Moped weight="bold" className="h-5 w-5" />
        </motion.span>
        <span className="absolute top-1/2 right-[7%] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-carbon bg-paper-white">
          <HouseLine weight="bold" className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3.5 rounded-2xl border border-carbon bg-mint-pop/25 px-3.5 py-3">
        <b className="block font-semibold">Next one: {deliveryDay} next week</b>
        <small className="text-carbon/65">Same basket, unless you change it</small>
      </div>
    </div>
  );
}

function Top({ title, pill }: { title: string; pill: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-center justify-between">
      <b className="logo-wordmark text-[22px] leading-none">{title}</b>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-carbon px-3 text-xs font-semibold">{pill}</span>
    </div>
  );
}
