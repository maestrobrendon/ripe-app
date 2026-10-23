"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { spring } from "@/lib/motion/tokens";
import { ProductImage } from "@/components/product-image";
import { MagneticLink, Reveal } from "../../home-next/parts/runtime";
import { MENU_GOALS, type MenuGoal } from "../recipes";
import { useMenu } from "@/components/menu-provider";
import type { MenuProduct } from "../types";
import { KachiMark } from "./art";
import { Check, Eyebrow } from "./shared";

/** Plays a little sequence once the card is on screen, and again when the goal changes. */
function useStage(steps: number, key: string, gap = 900) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-15% 0px" });
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!seen || reduced) return;
    // Rewind first (a goal change replays the sequence), then step through.
    const timers = [setTimeout(() => setStage(0), 0), ...Array.from({ length: steps }, (_, i) => setTimeout(() => setStage(i + 1), 350 + i * gap))];
    return () => timers.forEach(clearTimeout);
  }, [seen, reduced, steps, key, gap]);

  // With reduced motion every widget simply shows its finished state.
  return { ref, stage: reduced ? steps : stage };
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    // min-w-0: a grid item is otherwise as wide as its longest line (a
    // recipe name, the delivery row), which pushed the panels off a phone.
    <div className="flex min-w-0 flex-col">
      <div className="hm-panel relative h-[300px] overflow-hidden p-5">{children}</div>
      <div className="mt-5 flex gap-3.5 pr-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-carbon text-[13px] font-bold text-paper-white">{n}</span>
        <div>
          <h3 className="text-[18px] leading-snug font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--hm-ink-2)]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function KachiChat({ goal }: { goal: MenuGoal }) {
  const MENU = useMenu();
  const g = MENU_GOALS.find((x) => x.id === goal)!;
  const picks = MENU.filter((r) => r.goal === goal);
  const { ref, stage } = useStage(3, goal, 1000);

  return (
    <div ref={ref} className="flex h-full flex-col justify-end gap-3" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {stage >= 1 && (
          <motion.p
            key={`q-${goal}`}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.sheet}
            className="ml-auto max-w-[85%] rounded-[18px] rounded-br-md bg-carbon px-4 py-2.5 text-[14px] leading-snug text-paper-white"
          >
            {g.prompt}
          </motion.p>
        )}
        {stage === 2 && (
          <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            <KachiMark className="h-7 w-7" />
            <span className="hm-typing inline-flex gap-1 rounded-full bg-paper-white px-3 py-2.5" aria-label="Kachi is typing">
              <i className="h-1.5 w-1.5 rounded-full bg-carbon" />
              <i className="h-1.5 w-1.5 rounded-full bg-carbon" />
              <i className="h-1.5 w-1.5 rounded-full bg-carbon" />
            </span>
          </motion.div>
        )}
        {stage >= 3 && (
          <motion.div key={`a-${goal}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.sheet} className="flex items-start gap-2">
            <KachiMark className="mt-0.5 h-7 w-7" />
            <div className="max-w-[88%] rounded-[18px] rounded-tl-md bg-paper-white px-4 py-3 text-[14px] leading-snug">
              Here&apos;s a week built for that. I&apos;ve picked {picks.length === 1 ? "one recipe" : picks.length === 2 ? "two recipes" : picks.length === 3 ? "three recipes" : `${picks.length} recipes`} to start:
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {picks.map((r, i) => (
                  <motion.span
                    key={r.slug}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...spring.juicy, delay: 0.15 + i * 0.1 }}
                    className="rounded-full bg-[#e8ede3] px-2.5 py-1 text-[12px] font-semibold"
                  >
                    {r.title}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PLAN_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function WeekPlan({ goal }: { goal: MenuGoal }) {
  const MENU = useMenu();
  const own = MENU.filter((r) => r.goal === goal);
  const others = MENU.filter((r) => r.goal !== goal);
  // The goal's own recipes alternating with others from the menu, so the week
  // has range; however many each goal has, the five days are always filled.
  const week = Array.from({ length: Math.max(own.length, others.length) }, (_, i) => [own[i], others[i * 2 + 1]])
    .flat()
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .slice(0, PLAN_DAYS.length);
  const { ref, stage } = useStage(week.length, goal, 260);

  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <p className="text-[14px] font-semibold">Your week</p>
        <p className="text-[12px] text-[var(--hm-ink-3)]">Dinners</p>
      </div>
      <ul className="mt-3 flex flex-1 flex-col gap-1.5">
        {week.map((r, i) => (
          <motion.li
            key={`${goal}-${r.slug}`}
            initial={false}
            animate={{ opacity: stage > i ? 1 : 0.35, x: stage > i ? 0 : 6 }}
            transition={spring.smooth}
            className="flex items-center gap-3 rounded-[14px] bg-paper-white px-3 py-2"
          >
            <span className="w-8 shrink-0 text-[12px] font-semibold text-[var(--hm-ink-3)]">{PLAN_DAYS[i]}</span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.title}</span>
            <motion.span
              initial={false}
              animate={{ scale: stage > i ? 1 : 0, opacity: stage > i ? 1 : 0 }}
              transition={spring.juicy}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-pop"
            >
              <Check className="h-3.5 w-3.5" />
            </motion.span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

const TRACK = ["Packed", "On the way", "At your door"];

function Delivery({ goal, deliveryDay, products }: { goal: MenuGoal; deliveryDay: string; products: Record<string, MenuProduct> }) {
  const MENU = useMenu();
  const { ref, stage } = useStage(3, goal, 1100);
  // The produce the goal's three recipes share most, as the basket's faces.
  const counts = new Map<string, number>();
  for (const r of MENU.filter((x) => x.goal === goal)) for (const s of r.basket) counts.set(s, (counts.get(s) ?? 0) + 1);
  const faces = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s]) => products[s])
    .filter(Boolean)
    .slice(0, 5);
  const itemCount = counts.size;

  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="rounded-[18px] bg-paper-white p-4">
        <p className="text-[12px] font-medium text-[var(--hm-ink-3)]">Arriving {deliveryDay}</p>
        <p className="mt-0.5 text-[15px] font-semibold">Between 9am and 5pm</p>
        <div className="mt-3 flex items-center">
          <div className="flex -space-x-2">
            {faces.map((p) => (
              <ProductImage
                key={p.slug}
                publicId={p.cloudinaryPublicId}
                alt=""
                emoji={p.imageEmoji}
                sizes="36px"
                rounded="rounded-full"
                flavour="bg-[#e8ede3]"
                emojiClassName="text-base"
                className="h-9 w-9 ring-2 ring-paper-white"
              />
            ))}
          </div>
          <span className="ml-3 text-[13px] text-[var(--hm-ink-2)]">{itemCount} items for 3 recipes</span>
        </div>
      </div>

      <ol className="mt-4 flex flex-1 flex-col justify-center gap-0 pl-1">
        {TRACK.map((t, i) => {
          const done = stage > i;
          const now = stage === i + 1 && i < TRACK.length - 1;
          return (
            <li key={t} className="relative flex items-center gap-3 pb-4 last:pb-0">
              {i < TRACK.length - 1 && (
                <span className="absolute top-5 left-[9px] h-[calc(100%-12px)] w-0.5 overflow-hidden rounded-full bg-carbon/10">
                  <motion.span initial={false} animate={{ scaleY: stage > i + 1 ? 1 : 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="block h-full w-full origin-top bg-[#0f7a48]" />
                </span>
              )}
              <motion.span
                initial={false}
                animate={{ backgroundColor: done ? "var(--mint-pop)" : "rgba(0,0,0,0.08)", scale: now ? [1, 1.15, 1] : 1 }}
                transition={now ? { scale: { repeat: Infinity, duration: 1.4 } } : spring.snappy}
                className="relative grid h-5 w-5 place-items-center rounded-full"
              >
                {done && <Check className="h-3 w-3" />}
              </motion.span>
              <span className={`text-[14px] transition-colors ${done ? "font-semibold text-carbon" : "text-[var(--hm-ink-3)]"}`}>{t}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function How({ goal, deliveryDay, products, signedIn }: { goal: MenuGoal; deliveryDay: string; products: Record<string, MenuProduct>; signedIn: boolean }) {
  return (
    <section id="how" className="scroll-mt-20 py-16 sm:py-24">
      <div className="hm-wrap">
        <Reveal className="max-w-[40rem]">
          <Eyebrow className="text-electric-blue">How it works</Eyebrow>
          <h2 className="hm-h2">Three steps, then it just keeps coming.</h2>
        </Reveal>

        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-5">
          <Step n={1} title="Tell us your goal" body="Eat lighter, feed the family, train harder. Say it the way you'd say it to a friend.">
            <KachiChat goal={goal} />
          </Step>
          <Step n={2} title="Get a week you'll actually cook" body="Recipes and the produce to make them, picked for your household. Swap any of them.">
            <WeekPlan goal={goal} />
          </Step>
          <Step n={3} title="Confirm it, and it arrives" body="We remind you before each delivery. Pay when it comes.">
            <Delivery goal={goal} deliveryDay={deliveryDay} products={products} />
          </Step>
        </div>

        {/* Kachi gets one line here. Who she is and isn't (not a nutritionist)
            is answered in the questions, where someone who cares will look. */}
        <div className="mt-14 flex flex-col items-center gap-5 text-center">
          <p className="flex max-w-[34rem] items-start gap-3 text-left text-[16px] leading-relaxed text-[var(--hm-ink-2)]">
            <KachiMark className="mt-0.5 h-7 w-7 shrink-0" />
            <span>
              <b className="font-semibold text-carbon">Kachi</b>, your planner inside Basket, keeps the week going: &ldquo;What can I make with what&apos;s left?&rdquo;
            </span>
          </p>
          <MagneticLink href={signedIn ? "/assistant" : `/start?goal=${goal}`} variant="soft" arrow>
            {signedIn ? "Ask Kachi" : "Tell us your goal"}
          </MagneticLink>
        </div>
      </div>
    </section>
  );
}
