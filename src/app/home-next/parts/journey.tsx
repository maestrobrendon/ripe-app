"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";

const STOPS = [
  {
    when: "The day before, early",
    title: "It starts on a farm.",
    body: "We buy from farmers we work with directly. Not a wholesale floor, not a warehouse shelf, not produce that has been sitting.",
    img: "/images/home/farm.jpg",
    alt: "A farmer smiling in a green field, holding freshly picked tomatoes",
    pos: "50% 40%",
  },
  {
    when: "The day before, morning",
    title: "Picked when it is ready.",
    body: "Only what is ripe gets picked. If something is out of season it stays off the list, and we tell you so.",
    img: "/images/home/farmer.jpg",
    alt: "A woman in a field checking a ripe yellow tomato",
    pos: "40% 50%",
  },
  {
    when: "Delivery morning",
    title: "Checked by a person.",
    body: "Every order is looked over by hand before it leaves us. Anything bruised gets swapped, not shipped.",
    img: "/images/home/hands.jpg",
    alt: "Two hands holding fresh garden eggs",
    pos: "50% 45%",
  },
  {
    when: "Between 9am and 5pm",
    title: "On your day. At your door.",
    body: "The same day every week, inside the same window. No reminders to set, nobody to chase.",
    img: "/images/home/rider.jpg",
    alt: "A delivery rider on a motorcycle with a box on the back",
    pos: "55% 50%",
  },
  {
    when: "That evening",
    title: "Nobody went to the market.",
    body: "What you need for the week is already in the kitchen. That is the whole idea.",
    img: "/images/home/kitchen.jpg",
    alt: "A woman smiling as she adds fresh spinach to a dish in her kitchen",
    pos: "50% 30%",
  },
];

/**
 * A day in the life of a basket. On desktop the section pins and the photos
 * travel sideways as you scroll down, each with its own slower parallax. On
 * phones (and with reduced motion) it is a native swipe rail.
 */
export function Journey() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`${motionQueries.full} and ${motionQueries.desktop}`, () => {
        const el = track.current;
        if (!el) return;
        const distance = () => el.scrollWidth - window.innerWidth;
        const move = gsap.to(el, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section.current,
            pin: true,
            scrub: 0.7,
            start: "top top",
            end: () => `+=${distance()}`,
            invalidateOnRefresh: true,
            onUpdate: (s) => {
              const n = Math.min(STOPS.length, Math.max(1, Math.round(s.progress * (STOPS.length - 1)) + 1));
              const counter = section.current?.querySelector(".hn-count");
              if (counter) counter.textContent = String(n).padStart(2, "0");
            },
          },
        });
        gsap.utils.toArray<HTMLElement>(".hn-stop-img", el).forEach((img) => {
          gsap.fromTo(
            img,
            { xPercent: -7 },
            {
              xPercent: 7,
              ease: "none",
              scrollTrigger: { trigger: img.parentElement, containerAnimation: move, start: "left right", end: "right left", scrub: true },
            },
          );
        });
        gsap.utils.toArray<HTMLElement>(".hn-stop-copy", el).forEach((copy) => {
          gsap.from(copy.children, {
            autoAlpha: 0,
            y: 30,
            stagger: 0.08,
            duration: 0.8,
            scrollTrigger: { trigger: copy, containerAnimation: move, start: "left 75%" },
          });
        });
      });
    },
    { scope: section },
  );

  return (
    <section ref={section} id="journey" className="relative overflow-hidden bg-paper-white lg:h-svh">
      <div ref={track} className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-20 [scrollbar-width:none] sm:scroll-px-6 sm:px-6 lg:h-full lg:w-max lg:snap-none lg:items-center lg:gap-6 lg:overflow-visible lg:px-[max(24px,calc((100vw-1180px)/2))] lg:py-0 [&>*]:snap-start">
        {/* Intro panel */}
        <div className="flex w-[82vw] shrink-0 flex-col justify-between sm:w-[60vw] lg:h-[78svh] lg:w-[34rem]">
          <div>
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
              <i className="h-2.5 w-2.5 rounded-full border border-carbon bg-sunburst" aria-hidden />
              A day in the life of your basket
            </span>
            <h2 className="hn-display mt-5 text-[clamp(2.6rem,5.4vw,5rem)]">From the farm to your fridge.</h2>
            <p className="mt-5 max-w-[26rem] text-lg leading-normal text-carbon/75">
              About a day. Five stops. One person checking it before it leaves, and nobody standing in a queue.
            </p>
          </div>
          <p className="mt-8 hidden items-center gap-3 text-sm font-semibold lg:flex" aria-hidden>
            <span className="tabular-nums">
              <span className="hn-count">01</span> / {String(STOPS.length).padStart(2, "0")}
            </span>
            <span className="h-px w-16 bg-carbon" />
            Keep scrolling
          </p>
        </div>

        {STOPS.map((s, i) => (
          <article
            key={s.title}
            className="group relative w-[82vw] shrink-0 overflow-hidden rounded-card-lg border border-carbon sm:w-[60vw] lg:h-[78svh] lg:w-[min(64vw,56rem)]"
          >
            <div className="hn-grain relative aspect-[4/5] overflow-hidden sm:aspect-[4/3] lg:absolute lg:inset-0 lg:aspect-auto">
              {/* Wider than the card on both sides, so the sideways parallax never
                  shows an edge. */}
              <div className="hn-stop-img absolute inset-y-0 -right-[12%] -left-[12%]">
                <Image src={s.img} alt={s.alt} fill sizes="(min-width: 1024px) 75vw, 100vw" className="object-cover" style={{ objectPosition: s.pos }} />
              </div>
              <div className="absolute inset-0 bg-linear-to-t from-carbon/75 via-carbon/10 to-transparent" />
            </div>
            <div className="hn-stop-copy absolute inset-x-0 bottom-0 p-5 text-paper-white sm:p-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-carbon bg-paper-white px-3 py-1 text-xs font-semibold text-carbon">
                <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {s.when}
              </span>
              <h3 className="hn-display mt-4 max-w-[16ch] text-[clamp(1.9rem,3.4vw,3.4rem)]">{s.title}</h3>
              <p className="mt-3 max-w-[30rem] text-[15px] leading-relaxed text-paper-white/85 sm:text-base">{s.body}</p>
            </div>
          </article>
        ))}
        <div className="w-1 shrink-0 lg:hidden" aria-hidden />
      </div>
    </section>
  );
}
