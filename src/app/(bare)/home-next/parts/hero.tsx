"use client";

import Image from "next/image";
import { useRef } from "react";
import { gsap, SplitText, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { MagneticLink } from "./runtime";
import { ProduceSticker } from "./produce";
import type { FarmProduct } from "../types";

// Where each sticker lands around the illustration, as % of the stage, with
// its resting tilt. Kept to the edges so the drawing stays readable.
const SPOTS = [
  { left: "2%", top: "18%", r: -8, size: "w-22 sm:w-28" },
  { left: "74%", top: "4%", r: 7, size: "w-20 sm:w-26" },
  { left: "82%", top: "46%", r: -5, size: "w-18 sm:w-24" },
  { left: "-2%", top: "60%", r: 6, size: "w-18 sm:w-22" },
  { left: "40%", top: "-6%", r: 4, size: "w-16 sm:w-20" },
  { left: "60%", top: "80%", r: -6, size: "w-16 sm:w-20" },
];

export function Hero({
  stickers,
  deliveryDay,
  basketLabel,
  zones,
  signedIn,
}: {
  stickers: FarmProduct[];
  deliveryDay: string;
  basketLabel: string;
  zones: string[];
  signedIn: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        const split = SplitText.create(".hn-hero-title", { type: "words", mask: "words" });
        // Lift the pre-paint hiding; each tween below sets its own start state.
        gsap.set("[data-intro]", { visibility: "visible" });
        const tl = gsap.timeline({ defaults: { ease: "ripe.out" } });
        tl.from(split.words, { yPercent: 110, duration: 0.95, stagger: 0.05 }, 0.1)
          .add(() => root.current?.querySelector(".hn-mark")?.classList.add("is-on"), 0.7)
          .from("[data-hero-fade]", { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.08 }, 0.45)
          .from(".hn-hero-art", { autoAlpha: 0, scale: 0.9, y: 30, duration: 1.1, ease: "ripe.emphasized" }, 0.3)
          .from(
            ".hn-drop",
            {
              y: -460,
              rotation: () => gsap.utils.random(-50, 50),
              autoAlpha: 0,
              duration: 1.15,
              ease: "bounce.out",
              stagger: 0.09,
            },
            0.6,
          )
          .from(".hn-tag", { autoAlpha: 0, y: 14, scale: 0.9, duration: 0.5, stagger: 0.18, ease: "ripe.juicy" }, 1.5);

        // Idle float once everything has landed.
        gsap.to(".hn-drop-inner", {
          y: "-=7",
          duration: 2.4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          stagger: { each: 0.25, from: "random" },
          delay: 2.2,
        });

        return () => split.revert();
      });

      // The produce leans toward the pointer, each at its own depth.
      mm.add(`${motionQueries.full} and (hover: hover) and (pointer: fine)`, () => {
        const el = stage.current;
        if (!el) return;
        const drops = gsap.utils.toArray<HTMLElement>(".hn-drop", el);
        const art = el.querySelector(".hn-hero-art");
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          drops.forEach((d, i) => gsap.to(d, { x: x * (14 + i * 6), y: y * (10 + i * 4), duration: 0.7, ease: "power2.out" }));
          if (art) gsap.to(art, { x: x * -10, y: y * -6, rotation: x * 1.5, duration: 0.9, ease: "power2.out" });
        };
        el.addEventListener("pointermove", move);
        return () => el.removeEventListener("pointermove", move);
      });
    },
    { scope: root },
  );

  const ticker = [
    ["Picked", "the day before"],
    ["Packed", "the morning it leaves"],
    ["At your door", "between 9am and 5pm"],
    ["Checked", "by a person, every order"],
    ["Delivering to", zones.join(", ")],
  ];

  return (
    <section ref={root} className="relative bg-sky-wash pt-32 sm:pt-36">
      <div className="mx-auto grid w-[min(1180px,calc(100%-32px))] items-center gap-6 pb-12 sm:w-[min(1180px,calc(100%-48px))] lg:min-h-[calc(100svh-7rem)] lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-16">
        <div>
          <h1 data-intro className="hn-hero-title hn-display text-[clamp(2.5rem,5vw,5rem)]">
            Whatever the <br />
            goal, there&rsquo;s a <br />
            <span className="hn-mark">basket.</span>
          </h1>
          <p data-intro data-hero-fade className="mt-6 max-w-[34rem] text-[clamp(1.0625rem,1.4vw,1.3rem)] leading-normal text-carbon/80">
            A box of fresh fruit and vegetables that turns up on your day, every week. Set it once. Change it whenever you like.
          </p>
          <div id="hero-cta" data-intro data-hero-fade className="mt-8 flex flex-wrap gap-3">
            {signedIn ? (
              <MagneticLink href="/basket" arrow>
                Open your basket
              </MagneticLink>
            ) : (
              <MagneticLink href="/start" arrow>
                Try a basket free
              </MagneticLink>
            )}          </div>
          <p data-intro data-hero-fade className="mt-4 text-[13px] text-muted">
            Free to set up. No card, no membership. You pay for the produce when you check out.
          </p>
        </div>

        <div ref={stage} className="relative mx-auto mt-10 aspect-[1.16] w-full lg:mt-0 max-w-[560px] lg:max-w-none">
          <div data-intro className="hn-hero-art absolute inset-[8%]">
            <Image
              src="/images/hero-basket.webp"
              alt="People laughing in a basket full of fruit and vegetables"
              fill
              priority
              sizes="(min-width: 1024px) 520px, 90vw"
              className="object-contain"
            />
          </div>

          {stickers.slice(0, SPOTS.length).map((p, i) => (
            <div
              key={p.id}
              data-intro
              className={`hn-drop absolute ${SPOTS[i].size}`}
              style={{ left: SPOTS[i].left, top: SPOTS[i].top, rotate: `${SPOTS[i].r}deg` }}
            >
              <div className="hn-drop-inner">
                <ProduceSticker name={p.name} publicId={p.cloudinaryPublicId} emoji={p.imageEmoji} category={p.category} className="aspect-square w-full" />
              </div>
            </div>
          ))}

          <div data-intro className="hn-tag absolute top-[28%] left-[-2%] z-10 flex items-center gap-2 rounded-2xl border border-carbon bg-paper-white px-3.5 py-2.5 text-sm font-semibold sm:left-[-6%]">
            <i className="h-2 w-2 rounded-full bg-ember" aria-hidden />
            Arrives {deliveryDay}
          </div>
          <div data-intro className="hn-tag absolute right-[-2%] bottom-[14%] z-10 flex items-center gap-2 rounded-2xl border border-carbon bg-paper-white px-3.5 py-2.5 text-sm font-semibold">
            <i className="h-2 w-2 rounded-full bg-mint-pop" aria-hidden />
            {basketLabel}
          </div>
        </div>
      </div>

      <div className="overflow-hidden border-y border-carbon bg-paper-white" aria-hidden>
        <div className="hn-ticker flex w-max py-3.5 text-sm whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-14 pr-14">
              {ticker.map(([b, rest]) => (
                <span key={b} className="inline-flex items-center gap-2.5">
                  <i className="h-1.5 w-1.5 rounded-full bg-carbon" />
                  <b className="font-semibold">{b}</b>
                  <span className="text-carbon/70">{rest}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
