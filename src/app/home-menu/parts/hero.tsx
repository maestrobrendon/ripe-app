"use client";

import Image from "next/image";
import { useRef, type ComponentType, type SVGProps } from "react";
import { gsap, SplitText, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { MagneticLink, scrollToId } from "../../home-next/parts/runtime";
import { AvocadoHalf, Chilli, GardenEgg, LimeSlice, Mango, Sparkle, Sprig, Tomato, INK } from "./art";
import { MENU_GOALS, type MenuGoal } from "../recipes";

type Piece =
  | { kind: "art"; Art: ComponentType<SVGProps<SVGSVGElement>>; x: number; y: number; w: number; r: number; depth: number }
  | { kind: "photo"; src: string; x: number; y: number; w: number; r: number; depth: number }
  | { kind: "spark"; color: string; x: number; y: number; w: number; r: number; depth: number };

/*
 * Each cluster is a box a quarter of the hero wide; x, y and w are percent of
 * that box, so the arrangement scales with the screen instead of colliding
 * with the headline. Photos sit deepest, the drawings float in front.
 */
const LEFT: Piece[] = [
  { kind: "photo", src: "/images/menu/shakshuka.jpg", x: 22, y: 16, w: 52, r: -7, depth: 0.5 },
  { kind: "art", Art: Tomato, x: 66, y: 4, w: 26, r: 8, depth: 1.2 },
  { kind: "art", Art: AvocadoHalf, x: 2, y: 50, w: 34, r: -12, depth: 1 },
  { kind: "photo", src: "/images/menu/smoothie-bowl.jpg", x: 40, y: 60, w: 44, r: 6, depth: 0.6 },
  { kind: "art", Art: Sprig, x: 78, y: 46, w: 22, r: 14, depth: 1.4 },
  { kind: "spark", color: INK.sun, x: 8, y: 22, w: 9, r: 0, depth: 1.6 },
  { kind: "spark", color: INK.lavender, x: 30, y: 90, w: 7, r: 0, depth: 1.8 },
];

const RIGHT: Piece[] = [
  { kind: "photo", src: "/images/menu/shawarma-bowl.jpg", x: 26, y: 12, w: 54, r: 6, depth: 0.5 },
  { kind: "art", Art: Chilli, x: 4, y: 2, w: 28, r: -6, depth: 1.3 },
  { kind: "art", Art: LimeSlice, x: 74, y: 44, w: 26, r: 0, depth: 1.1 },
  { kind: "photo", src: "/images/menu/avocado-toast.jpg", x: 14, y: 58, w: 46, r: -5, depth: 0.6 },
  { kind: "art", Art: Mango, x: 62, y: 72, w: 32, r: 10, depth: 1 },
  { kind: "art", Art: GardenEgg, x: 0, y: 40, w: 18, r: -10, depth: 1.5 },
  { kind: "spark", color: INK.mint, x: 88, y: 8, w: 9, r: 0, depth: 1.7 },
];

/** The phone-width row above the headline: the same cast, smaller. */
const STRIP: Piece[] = [
  { kind: "art", Art: Tomato, x: 0, y: 0, w: 0, r: -8, depth: 1 },
  { kind: "art", Art: AvocadoHalf, x: 0, y: 0, w: 0, r: 10, depth: 1 },
  { kind: "photo", src: "/images/menu/shawarma-bowl.jpg", x: 0, y: 0, w: 0, r: -4, depth: 1 },
  { kind: "art", Art: LimeSlice, x: 0, y: 0, w: 0, r: 0, depth: 1 },
  { kind: "art", Art: Chilli, x: 0, y: 0, w: 0, r: 6, depth: 1 },
];

function PieceBody({ p, sizes }: { p: Piece; sizes: string }) {
  if (p.kind === "photo") {
    return (
      <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)]">
        <Image src={p.src} alt="" fill sizes={sizes} className="object-cover" priority />
      </div>
    );
  }
  if (p.kind === "spark") return <Sparkle color={p.color} className="h-auto w-full" />;
  const Art = p.Art;
  return <Art className="h-auto w-full drop-shadow-[0_14px_14px_rgb(0_0_0/0.12)]" />;
}

function Cluster({ pieces, side }: { pieces: Piece[]; side: "left" | "right" }) {
  return (
    <div className={`hm-cluster pointer-events-none absolute inset-y-0 hidden w-[25%] lg:block ${side === "left" ? "left-0" : "right-0"}`} data-side={side} aria-hidden>
      {pieces.map((p, i) => (
        <div
          key={i}
          data-intro
          data-depth={p.depth}
          className="hm-pop absolute"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, rotate: `${p.r}deg`, zIndex: Math.round(p.depth * 10) }}
        >
          <div className="hm-float">
            <PieceBody p={p} sizes="(min-width: 1024px) 180px, 0px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Hero({ signedIn, onPickGoal }: { signedIn: boolean; onPickGoal: (g: MenuGoal) => void }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        const split = SplitText.create(".hm-hero-title", { type: "lines,words", mask: "lines" });
        gsap.set("[data-intro]", { visibility: "visible" });

        const tl = gsap.timeline({ defaults: { ease: "ripe.out" } });
        tl.from(split.words, { yPercent: 115, duration: 1, stagger: 0.06 }, 0.1)
          .from("[data-hero-fade]", { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.08 }, 0.5)
          .from(
            ".hm-pop",
            {
              autoAlpha: 0,
              scale: 0.4,
              y: 40,
              rotation: () => gsap.utils.random(-25, 25),
              duration: 1.1,
              ease: "back.out(1.5)",
              stagger: { each: 0.06, from: "random" },
            },
            0.35,
          );

        // Once everything has landed, each piece breathes on its own clock.
        gsap.utils.toArray<HTMLElement>(".hm-float").forEach((el, i) => {
          gsap.to(el, {
            y: i % 2 ? -9 : -14,
            rotation: i % 3 === 0 ? 3 : -2,
            duration: 2.6 + (i % 4) * 0.45,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: 1.6 + (i % 5) * 0.2,
          });
        });

        // As the hero scrolls away the two clusters part and lift.
        gsap.to(".hm-cluster[data-side='left']", { xPercent: -14, yPercent: -10, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
        gsap.to(".hm-cluster[data-side='right']", { xPercent: 14, yPercent: -10, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });

        return () => split.revert();
      });

      // The pieces lean toward the pointer, each at its own depth.
      mm.add(`${motionQueries.full} and (hover: hover) and (pointer: fine)`, () => {
        const el = root.current;
        if (!el) return;
        const pieces = gsap.utils.toArray<HTMLElement>(".hm-cluster .hm-pop");
        const movers = pieces.map((p) => {
          const d = Number(p.dataset.depth ?? 1);
          return { d, x: gsap.quickTo(p, "x", { duration: 0.9, ease: "power3.out" }), y: gsap.quickTo(p, "y", { duration: 0.9, ease: "power3.out" }) };
        });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          movers.forEach((m) => {
            m.x(nx * 26 * m.d);
            m.y(ny * 20 * m.d);
          });
        };
        el.addEventListener("pointermove", move);
        return () => el.removeEventListener("pointermove", move);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden pt-24 pb-16 sm:pt-32 lg:pt-36 lg:pb-24">
      <div className="relative mx-auto w-[min(1360px,calc(100%-32px))] lg:min-h-[640px]">
        <Cluster pieces={LEFT} side="left" />
        <Cluster pieces={RIGHT} side="right" />

        <div className="relative z-20 mx-auto flex max-w-[620px] flex-col items-center text-center">
          {/* Phones get the cast in one row instead of two flanks. */}
          <div className="mb-8 flex items-end justify-center gap-3 lg:hidden" aria-hidden>
            {STRIP.map((p, i) => (
              <div key={i} data-intro className="hm-pop" style={{ rotate: `${p.r}deg`, width: p.kind === "photo" ? 64 : 48 }}>
                <div className="hm-float">
                  <PieceBody p={p} sizes="64px" />
                </div>
              </div>
            ))}
          </div>

          <h1 className="hm-hero-title hm-display text-[clamp(3.1rem,8.4vw,6rem)]">
            Eat for
            <br />
            your goal.
          </h1>

          <p data-intro data-hero-fade className="hm-lede mt-6 max-w-[34rem]">
            Tell us what you&apos;re working toward. We&apos;ll give you the plan, the recipes and the fresh produce to make it happen, delivered on your day.
          </p>

          <div data-intro data-hero-fade className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <MagneticLink href={signedIn ? "/basket" : "/start"} arrow>
              {signedIn ? "Open your basket" : "Get started"}
            </MagneticLink>
            <MagneticLink href="#menu" variant="soft">
              See this week&apos;s menu
            </MagneticLink>
          </div>

          <div data-intro data-hero-fade className="mt-12 w-full">
            <p className="text-[14px] font-medium text-[var(--hm-ink-3)]">What are you working toward?</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {MENU_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onPickGoal(g.id);
                    scrollToId("menu");
                  }}
                  className="h-10 rounded-full bg-paper-white px-4 text-[14px] font-semibold shadow-[0_0_0_1px_var(--hm-line)] transition-[background-color,box-shadow] hover:bg-[#f3f5f0] hover:shadow-[0_0_0_1px_rgb(0_0_0/0.18)] active:scale-[0.97]"
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
