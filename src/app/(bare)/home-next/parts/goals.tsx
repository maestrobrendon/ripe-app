"use client";

import { useRef } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { gsap, ScrollTrigger, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { spring } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";
import { RollingNumber } from "@/components/ui/rolling-number";
import { MagneticLink, Reveal } from "./runtime";
import { ProduceSticker } from "./produce";
import type { FarmProduct, ShowcaseGoal } from "../types";

export function Goals({
  goals,
  active,
  onChange,
  signedIn,
}: {
  goals: ShowcaseGoal[];
  active: string;
  onChange: (slug: string) => void;
  signedIn: boolean;
}) {
  const goal = goals.find((g) => g.slug === active) ?? goals[0];
  if (!goal) return null;

  return (
    <section id="goals" data-nav-dark className="rounded-t-[48px] bg-carbon py-24 text-paper-white sm:py-28">
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] sm:w-[min(1180px,calc(100%-48px))]">
        <Reveal>
          <h2 className="hn-display text-[clamp(2.6rem,5.8vw,5.4rem)]">
            One basket.
            <br />
            Whatever the goal.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-4 max-w-[34rem] text-lg text-paper-white/70">
            Tell us who you are feeding and what you want more of. We build the basket. You change anything you like.
          </p>
        </Reveal>

        <LayoutGroup id="hn-goal-tabs">
          <div role="tablist" aria-label="Basket goals" className="mt-9 flex flex-wrap gap-2">
            {goals.map((g) => {
              const on = g.slug === goal.slug;
              return (
                <button
                  key={g.slug}
                  role="tab"
                  aria-selected={on}
                  onClick={() => onChange(g.slug)}
                  className={`relative h-12 rounded-full px-5 font-semibold transition-colors duration-(--dur-base) ${
                    on ? "text-carbon" : "text-paper-white/80 hover:text-paper-white"
                  }`}
                >
                  {on && <motion.span layoutId="hn-goal-pill" transition={spring.indicator} className="absolute inset-0 rounded-full bg-paper-white" />}
                  {!on && <span className="absolute inset-0 rounded-full border border-paper-white/20" />}
                  <span className="relative">{g.tab}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="tabpanel" aria-label={goal.title}>
            <AnimatePresence mode="popLayout" initial={false}>
              {goal.picks.slice(0, 6).map((p, i) => (
                <motion.div
                  key={`${goal.slug}-${p.productId}`}
                  layout
                  initial={{ opacity: 0, y: 22, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.94, transition: { duration: 0.18 } }}
                  transition={{ ...spring.smooth, delay: 0.04 * i }}
                  whileHover={{ y: -4, rotate: i % 2 ? 1.2 : -1.2 }}
                  className="flex min-h-40 flex-col justify-between gap-4 rounded-[22px] border border-paper-white/15 bg-paper-white/[0.06] p-4"
                >
                  <ProduceSticker
                    name={p.name}
                    publicId={p.cloudinaryPublicId}
                    emoji={p.imageEmoji}
                    rounded="rounded-2xl"
                    className="aspect-square w-16 border-paper-white/20! sm:w-20"
                    emojiClassName="text-4xl"
                    sizes="80px"
                  />
                  <span>
                    <b className="block text-[15px] font-semibold">{p.name}</b>
                    <small className="text-[13px] text-paper-white/60 tabular-nums">
                      {p.quantity} × {formatNaira(p.standardPrice)}
                    </small>
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <motion.div layout transition={spring.smooth} className="rounded-card-lg border border-paper-white bg-paper-white p-6.5 text-carbon">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={goal.slug}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                <h3 className="text-2xl font-semibold tracking-[-0.03em]">{goal.title}</h3>
                <p className="mt-2 text-[15px] leading-normal text-carbon/70">{goal.body}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-6 flex items-baseline gap-2.5">
              <RollingNumber value={goal.standardTotal} format={formatNaira} className="text-[40px] leading-none font-semibold tracking-[-0.04em]" />
              <small className="text-sm text-carbon/65">a week</small>
            </div>
            {goal.memberTotal < goal.standardTotal && (
              <p className="mt-2 text-sm font-semibold">
                <span className="rounded-md bg-lavender px-1.5 py-0.5">Members pay {formatNaira(goal.memberTotal)}</span>, delivery included
              </p>
            )}
            <MagneticLink href={signedIn ? "/basket" : "/start"} className="mt-6 w-full" arrow>
              {signedIn ? "Open your basket" : "Start with this basket"}
            </MagneticLink>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * What is on the farm this week: two rows drifting in opposite directions.
 * Scrolling fast pushes them faster for a moment; hovering slows them down
 * so a price can be read.
 */
export function Farm({ products }: { products: FarmProduct[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        const a = gsap.to(".hn-row-a", { xPercent: -50, duration: 60, ease: "none", repeat: -1 });
        const b = gsap.fromTo(".hn-row-b", { xPercent: -50 }, { xPercent: 0, duration: 70, ease: "none", repeat: -1 });
        const rows = [a, b];
        let hover = false;
        let settle: gsap.core.Tween | null = null;
        const st = ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (s) => {
            const v = Math.abs(s.getVelocity());
            if (hover || v < 60) return;
            settle?.kill();
            gsap.set(rows, { timeScale: 1 + Math.min(5, v / 300) });
            settle = gsap.to(rows, { timeScale: 1, duration: 1.4, ease: "power2.out" });
          },
        });
        const el = root.current;
        const enter = () => {
          hover = true;
          settle?.kill();
          gsap.to(rows, { timeScale: 0.2, duration: 0.6 });
        };
        const leave = () => {
          hover = false;
          gsap.to(rows, { timeScale: 1, duration: 0.6 });
        };
        el?.addEventListener("pointerenter", enter);
        el?.addEventListener("pointerleave", leave);
        return () => {
          st.kill();
          el?.removeEventListener("pointerenter", enter);
          el?.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: root },
  );

  if (products.length === 0) return null;
  const half = Math.ceil(products.length / 2);
  const rowA = products.slice(0, half);
  const rowB = products.slice(half).length ? products.slice(half) : products;

  return (
    <section data-nav-dark className="bg-carbon pt-10 pb-28 text-paper-white">
      <div className="mx-auto flex w-[min(1180px,calc(100%-32px))] flex-wrap items-end justify-between gap-5 sm:w-[min(1180px,calc(100%-48px))]">
        <Reveal>
          <h2 className="hn-display text-[clamp(2rem,4vw,3.4rem)]">On the farm this week.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="max-w-[26rem] text-paper-white/70">Only what is in season, so it tastes the way it should. When something is not, we say so.</p>
        </Reveal>
      </div>
      <div ref={root} className="mt-8 overflow-hidden">
        {[rowA, rowB].map((row, r) => (
          <div key={r} className={`flex w-max will-change-transform motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:px-4 ${r ? "hn-row-b mt-3.5" : "hn-row-a"}`}>
            {[0, 1].map((copy) => (
              <div key={copy} className={`flex gap-3.5 pr-3.5 ${copy ? "motion-reduce:hidden" : "motion-reduce:flex-wrap"}`} aria-hidden={copy === 1}>
                {row.map((p) => (
                  <div key={p.id} className="flex min-w-60 items-center gap-3.5 rounded-[22px] border border-paper-white/12 bg-paper-white/[0.06] py-3 pr-5 pl-3">
                    <ProduceSticker
                      name={p.name}
                      publicId={p.cloudinaryPublicId}
                      emoji={p.imageEmoji}
                      category={p.category}
                      rounded="rounded-2xl"
                      className="h-14 w-14 shrink-0 border-paper-white/20!"
                      emojiClassName="text-3xl"
                      sizes="56px"
                    />
                    <span className="min-w-0">
                      <b className="block truncate text-[15px] font-semibold">{p.name}</b>
                      <small className="text-xs text-paper-white/60">
                        {formatNaira(p.standardPrice)} {p.unit}
                      </small>
                    </span>
                    <span
                      className={`ml-auto shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        p.inSeason ? "bg-mint-pop text-carbon" : "bg-paper-white/10 text-paper-white/60"
                      }`}
                    >
                      {p.inSeason ? "In season" : "Off season"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
