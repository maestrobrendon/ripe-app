"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion } from "motion/react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { spring } from "@/lib/motion/tokens";
import { Arrow, Reveal, scrollToId } from "./runtime";

const PEOPLE = [
  {
    img: "/images/home/gym.jpg",
    alt: "A man in a vest dusting chalk off his hands in a gym",
    who: "The 6am lifter.",
    line: "You log every set. The bananas deserve the same planning.",
    goal: "post-workout-recovery",
    wash: "bg-electric-blue",
    pos: "50% 30%",
  },
  {
    img: "/images/home/parent.jpg",
    alt: "A mother showing her daughter how to slice a red pepper",
    who: "The one feeding everyone.",
    line: "Four people, four opinions, one basket that covers the whole table.",
    goal: "family-household",
    wash: "bg-sunburst",
    pos: "50% 25%",
  },
  {
    img: "/images/home/chop.jpg",
    alt: "A woman preparing vegetables outdoors",
    who: "The Sunday prepper.",
    line: "Meal prep goes a lot faster when the greens are already in the fridge.",
    goal: "general-wellness",
    wash: "bg-mint-pop",
    pos: "18% 50%",
  },
  {
    img: "/images/home/bite.jpg",
    alt: "A man taking a big bite out of a red apple",
    who: "The one starting today.",
    line: "No plan yet? Good. Start with one basket and see how the week feels.",
    goal: "weight-management",
    wash: "bg-lavender",
    pos: "40% 40%",
  },
];

/**
 * Who it is for. Each card is a person the reader might recognise, and
 * tapping one opens the basket built for them in the goal switcher above.
 */
export function People({ goalLabels, onPick }: { goalLabels: Record<string, string>; onPick: (slug: string) => void }) {
  return (
    <section className="relative -mt-12 rounded-t-[48px] bg-paper-white py-24 sm:py-32">
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] sm:w-[min(1180px,calc(100%-48px))]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
              <i className="h-2.5 w-2.5 rounded-full border border-carbon bg-lavender" aria-hidden />
              Who it is for
            </span>
            <h2 className="hn-display mt-5 max-w-[14ch] text-[clamp(2.4rem,5.2vw,4.8rem)]">For people who have already decided.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-[24rem] text-lg text-carbon/75">
              Eating better is not the hard part. Remembering to buy it, every week, is. That part is ours now.
            </p>
          </Reveal>
        </div>

        <Reveal stagger={0.08} className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PEOPLE.map((p, i) => (
            <div key={p.who}>
            <motion.button
              type="button"
              onClick={() => {
                onPick(p.goal);
                scrollToId("goals");
              }}
              whileHover="hover"
              whileTap={{ scale: 0.985 }}
              initial="rest"
              animate="rest"
              variants={{ rest: { rotate: 0, y: 0 }, hover: { rotate: i % 2 ? 1.2 : -1.2, y: -6 } }}
              transition={spring.smooth}
              className="group relative block w-full aspect-[3/4] overflow-hidden rounded-card-lg border border-carbon text-left sm:aspect-[4/5] lg:aspect-[3/4.4]"
            >
              <motion.span className="absolute inset-0" variants={{ rest: { scale: 1.02 }, hover: { scale: 1.09 } }} transition={spring.smooth}>
                <Image src={p.img} alt={p.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover" style={{ objectPosition: p.pos }} />
              </motion.span>
              <span className="absolute inset-0 bg-linear-to-t from-carbon/80 via-carbon/10 to-transparent" />
              <span className={`absolute top-4 left-4 rounded-full border border-carbon px-3 py-1 text-xs font-semibold text-carbon ${p.wash}`}>
                {goalLabels[p.goal] ?? ""}
              </span>
              <span className="absolute inset-x-0 bottom-0 block p-5 text-paper-white">
                <span className="block text-2xl leading-tight font-semibold tracking-[-0.03em]">{p.who}</span>
                <span className="mt-2 block text-[15px] leading-snug text-paper-white/80">{p.line}</span>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                  See their basket <Arrow />
                </span>
              </span>
            </motion.button>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/** A full-bleed photograph that moves slower than the page. */
export function MarketBand() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        gsap.fromTo(
          ".hn-band-img",
          { yPercent: -10, scale: 1.12 },
          { yPercent: 10, scale: 1.02, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true } },
        );
      });
    },
    { scope: ref },
  );

  return (
    <section ref={ref} data-nav-dark className="hn-grain relative isolate flex min-h-[105svh] items-end overflow-hidden bg-carbon text-paper-white">
      <div className="hn-band-img absolute inset-0 -z-10">
        <Image
          src="/images/home/market.jpg"
          alt="A woman at a Lagos market stall, surrounded by buckets of tomatoes"
          fill
          sizes="100vw"
          className="object-cover object-[50%_30%]"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-carbon/85 via-carbon/25 to-carbon/10" />
      <div className="mx-auto w-[min(1180px,calc(100%-32px))] pb-16 sm:w-[min(1180px,calc(100%-48px))] sm:pb-24">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-carbon bg-paper-white px-3 py-1 text-xs font-semibold text-carbon">
            Saturday, 10am
          </span>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="hn-display mt-5 text-[clamp(3rem,9vw,8.5rem)]">Keep your Saturday.</h2>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 max-w-[34rem] text-lg leading-normal text-paper-white/85 sm:text-xl">
            Two hours at the market every week adds up to more than four days a year. The market will be fine without you. Spend them on something else.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
