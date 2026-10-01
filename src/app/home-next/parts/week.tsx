"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Barbell, Leaf, Car, Fire, Basket, CalendarCheck, Sparkle } from "@phosphor-icons/react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { spring } from "@/lib/motion/tokens";

const DAYS = [
  { day: "Monday", short: "M", line: "New week. This time you mean it.", Icon: Sparkle, wash: "bg-sunburst" },
  { day: "Tuesday", short: "T", line: "Gym at six. Bread and tea at eight.", Icon: Barbell, wash: "bg-electric-blue" },
  { day: "Wednesday", short: "W", line: "The spinach from Saturday has quietly given up.", Icon: Leaf, wash: "bg-mint-pop" },
  { day: "Thursday", short: "T", line: "Market after work? Third Mainland says no.", Icon: Car, wash: "bg-lavender" },
  { day: "Friday", short: "F", line: "It is Friday. Suya counts as protein.", Icon: Fire, wash: "bg-ember" },
  { day: "Saturday", short: "S", line: "Two hours at the market. One argument about the price of tomatoes.", Icon: Basket, wash: "bg-sunburst" },
  { day: "Sunday", short: "S", line: "Next week will be different.", Icon: CalendarCheck, wash: "bg-mint-pop" },
];

const FRAMES = DAYS.length + 1;

/**
 * "A normal week": seven days told one at a time as you scroll, then the turn.
 * The section is tall and its inner stage sticks, so the reader's own scroll
 * is the playhead.
 */
export function Week() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [frame, setFrame] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => setFrame(Math.min(FRAMES - 1, Math.max(0, Math.floor(p * FRAMES)))));

  if (reduced) {
    return (
      <section className="mx-auto w-[min(1180px,calc(100%-32px))] py-24 sm:w-[min(1180px,calc(100%-48px))]">
        <p className="text-[13px] font-semibold">A normal week in Lagos</p>
        <ol className="mt-8 space-y-6">
          {DAYS.map((d) => (
            <li key={d.day}>
              <p className="hn-display text-4xl">{d.day}</p>
              <p className="mt-1 text-lg">{d.line}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-xl font-medium">It can be. Not with more willpower. With less to plan.</p>
      </section>
    );
  }

  const outro = frame === FRAMES - 1;
  const current = DAYS[Math.min(frame, DAYS.length - 1)];

  return (
    <section ref={ref} className="relative" style={{ height: `${FRAMES * 62}svh` }} aria-label="A normal week in Lagos">
      <div
        data-nav-dark={outro || undefined}
        className={`sticky top-0 flex h-svh flex-col overflow-hidden transition-colors duration-(--dur-slower) ${
          outro ? "bg-carbon text-paper-white" : "bg-paper-white text-carbon"
        }`}
      >
        <div className="mx-auto flex w-[min(1180px,calc(100%-32px))] items-center justify-between pt-24 text-[13px] font-semibold sm:w-[min(1180px,calc(100%-48px))] sm:pt-28">
          <span className="inline-flex items-center gap-2">
            <i className={`h-2.5 w-2.5 rounded-full border ${outro ? "border-paper-white bg-mint-pop" : "border-carbon bg-ember"}`} aria-hidden />
            A normal week in Lagos
          </span>
          <span className="tabular-nums opacity-70">
            {outro ? "And then" : `${String(frame + 1).padStart(2, "0")} / 07`}
          </span>
        </div>

        <div className="relative mx-auto flex w-[min(1180px,calc(100%-32px))] flex-1 items-center sm:w-[min(1180px,calc(100%-48px))]">
          <AnimatePresence mode="popLayout" initial={false}>
            {!outro ? (
              <motion.div
                key={current.day}
                initial={{ opacity: 0, y: 70 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -70 }}
                transition={spring.smooth}
                className="w-full"
              >
                {/* Icon above the name on phones, beside it from sm up. The type is
                    sized so the longest day, Wednesday, fits the width. */}
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-6">
                  <motion.span
                    initial={{ scale: 0.4, rotate: -30 }}
                    animate={{ scale: 1, rotate: -8 }}
                    transition={{ ...spring.juicy, delay: 0.08 }}
                    className={`mb-2 grid h-14 w-14 shrink-0 place-items-center rounded-full border border-carbon sm:mb-5 sm:h-24 sm:w-24 ${current.wash}`}
                  >
                    <current.Icon weight="bold" className="h-6 w-6 sm:h-10 sm:w-10" />
                  </motion.span>
                  <h2 className="hn-display text-[13.5vw] leading-[0.85] whitespace-nowrap sm:text-[min(11.5vw,10rem)]">{current.day}</h2>
                </div>
                <p className="mt-6 max-w-[40rem] text-[clamp(1.4rem,3vw,2.6rem)] leading-tight font-medium tracking-[-0.03em]">
                  {current.line}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="outro"
                initial={{ opacity: 0, y: 70 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -70 }}
                transition={spring.smooth}
                className="w-full"
              >
                <p className="hn-display text-[clamp(2.6rem,8vw,7.5rem)]">It can be.</p>
                <p className="mt-6 max-w-[44rem] text-[clamp(1.4rem,3vw,2.6rem)] leading-tight font-medium tracking-[-0.03em] text-paper-white/85">
                  Not with more willpower. With less to plan. Keep reading.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The week itself, filling as you go. */}
        <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] grid-cols-7 gap-1.5 pb-10 sm:w-[min(1180px,calc(100%-48px))] sm:gap-2.5 sm:pb-14">
          {DAYS.map((d, i) => (
            <Segment key={d.day} index={i} progress={scrollYProgress} label={d.short} active={i === frame} inverse={outro} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Segment({
  index,
  progress,
  label,
  active,
  inverse,
}: {
  index: number;
  progress: MotionValue<number>;
  label: string;
  active: boolean;
  inverse: boolean;
}) {
  const fill = useTransform(progress, (p) => Math.min(1, Math.max(0, p * FRAMES - index)));
  return (
    <div>
      <div className={`h-1.5 overflow-hidden rounded-full ${inverse ? "bg-paper-white/20" : "bg-soft-mist"}`}>
        <motion.div style={{ scaleX: fill }} className={`h-full origin-left rounded-full ${inverse ? "bg-mint-pop" : "bg-carbon"}`} />
      </div>
      <p className={`mt-2 text-xs font-semibold transition-opacity ${active ? "opacity-100" : "opacity-40"}`}>{label}</p>
    </div>
  );
}

/**
 * The pinned three-line statement. Each line rises in, holds, and lifts away
 * as the next arrives; the last one stays and gets underlined.
 */
export function Statement() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        const lines = gsap.utils.toArray<HTMLElement>(".hn-line");
        const dots = gsap.utils.toArray<HTMLElement>(".hn-dot");
        const last = lines[lines.length - 1];
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: ref.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            onUpdate: (s) => {
              const i = Math.min(2, Math.floor(s.progress * 3));
              dots.forEach((d, j) => d.classList.toggle("bg-paper-white", j === i));
              last.querySelector(".hn-mark")?.classList.toggle("is-on", s.progress > 0.72);
            },
          },
        });
        gsap.set(lines, { position: "absolute" });
        lines.forEach((l, i) => {
          // The first line is already there when the section arrives, so it
          // never opens on an empty black screen.
          if (i > 0) tl.fromTo(l, { autoAlpha: 0, y: 70, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1 }, i * 2);
          if (i < lines.length - 1) tl.to(l, { autoAlpha: 0, y: -70, scale: 1.02, duration: 1 }, i * 2 + 1.2);
        });
      });
      mm.add(motionQueries.reduced, () => {
        ref.current?.querySelector(".hn-mark")?.classList.add("is-on");
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} data-nav-dark className="relative bg-carbon text-paper-white motion-safe:h-[260svh]">
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-24 text-center motion-safe:sticky motion-safe:top-0 motion-safe:h-svh motion-safe:gap-0 motion-safe:py-0">
        {[
          <>Grocery apps make you shop.</>,
          <>Fitness apps make you track.</>,
          <>
            Basket makes you <span className="hn-mark hn-mark-full">eat well.</span>
          </>,
        ].map((line, i) => (
          <p key={i} className="hn-line hn-display w-[min(1000px,92vw)] text-[clamp(2.4rem,6.6vw,6rem)]">
            {line}
          </p>
        ))}
        <div className="absolute bottom-10 hidden gap-2 motion-safe:flex" aria-hidden>
          {[0, 1, 2].map((i) => (
            <i key={i} className={`hn-dot h-2 w-2 rounded-full border border-paper-white/60 transition-colors ${i === 0 ? "bg-paper-white" : ""}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
