"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { gsap, SplitText, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { MagneticLink, scrollToId } from "../../home-next/parts/runtime";
import { MENU_GOALS, type MenuGoal } from "../recipes";

/*
 * The illustration is one generated scene (public/assets/illustrations/hero,
 * see CREDITS.txt) cut into transparent layers. x, y, w and h are each
 * layer's box in the 1536×1024 source, so the scene reassembles exactly; each
 * layer then hangs from its nearest corner of the hero, scaled by --s (screen
 * px per source px, set in home-menu.css), so the centre stays empty for the
 * headline at any width. On phones the same corners become a top and a
 * bottom band.
 *
 * Two layers sit away from where the source drew them: the yoghurt bowl is
 * tucked further into its corner, clear of the logo (source x 81, y 0), and
 * the chilli bowl moves from top centre (x 868, y 25), where it crowded the
 * headline and the nav, down beside the lime.
 */
const SRC_W = 1536;
const SRC_H = 1024;

type Layer = { name: string; x: number; y: number; w: number; h: number; depth: number; preload?: boolean };

const LAYERS: Layer[] = [
  { name: "salad", x: 0, y: 459, w: 493, h: 565, depth: 0.5, preload: true },
  { name: "shawarma", x: 1031, y: 0, w: 505, h: 556, depth: 0.5, preload: true },
  { name: "hand", x: 1218, y: 668, w: 318, h: 356, depth: 0.9, preload: true },
  { name: "yoghurt", x: -50, y: -40, w: 288, h: 223, depth: 0.7 },
  { name: "chilli", x: 840, y: 830, w: 206, h: 205, depth: 0.8 },
  { name: "lime-left", x: 4, y: 181, w: 168, h: 161, depth: 1.3 },
  { name: "lime-right", x: 1403, y: 533, w: 133, h: 134, depth: 1.4 },
  { name: "lime-bottom", x: 1148, y: 898, w: 171, h: 126, depth: 1.2 },
  { name: "flecks-tl", x: 10, y: 17, w: 217, h: 420, depth: 1.7 },
  { name: "flecks-tr", x: 822, y: 147, w: 435, h: 261, depth: 1.7 },
  { name: "flecks-br", x: 1004, y: 511, w: 519, h: 467, depth: 1.7 },
];

const isLeft = (l: Layer) => l.x + l.w / 2 < SRC_W / 2;
const isTop = (l: Layer) => l.y + l.h / 2 < SRC_H / 2;

function place(l: Layer): CSSProperties {
  const left = isLeft(l);
  const top = isTop(l);
  return {
    width: `calc(${l.w} * var(--s))`,
    [left ? "left" : "right"]: `calc(${left ? l.x : SRC_W - l.x - l.w} * var(--s) - var(--push))`,
    [top ? "top" : "bottom"]: `calc(${top ? l.y : SRC_H - l.y - l.h} * var(--s))`,
  };
}

/** Rendered width as a share of the viewport at each --s, for next/image. */
function sizes(l: Layer) {
  const vw = (k: number) => `${Math.ceil((l.w / SRC_W) * 100 * k)}vw`;
  return `(min-width: 1024px) ${vw(1)}, (min-width: 640px) ${vw(0.85)}, ${vw(1.25)}`;
}

function Side({ side }: { side: "left" | "right" }) {
  return (
    <div className="hm-side absolute inset-0" data-side={side}>
      {LAYERS.filter((l) => isLeft(l) === (side === "left")).map((l) => (
        <div key={l.name} data-intro data-depth={l.depth} data-from={`${isLeft(l) ? -1 : 1},${isTop(l) ? -1 : 1}`} className="hm-layer" style={place(l)}>
          <div className="hm-tilt">
            <div className="hm-float">
              <Image
                src={`/assets/illustrations/hero/layers/${l.name}.webp`}
                alt=""
                width={l.w}
                height={l.h}
                sizes={sizes(l)}
                preload={l.preload}
                draggable={false}
              />
            </div>
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

        // Each layer slides in from the corner it hangs from.
        const from = (el: Element) => (el as HTMLElement).dataset.from!.split(",").map(Number);
        const tl = gsap.timeline({ defaults: { ease: "ripe.out" } });
        tl.from(split.words, { yPercent: 115, duration: 1, stagger: 0.06 }, 0.1)
          .from("[data-hero-fade]", { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.08 }, 0.5)
          .from(
            ".hm-layer",
            {
              autoAlpha: 0,
              x: (_, el) => from(el)[0] * 56,
              y: (_, el) => from(el)[1] * 40,
              rotation: () => gsap.utils.random(-6, 6),
              duration: 1.3,
              stagger: { each: 0.05, from: "random" },
            },
            0.2,
          );

        // Once everything has landed, each layer breathes on its own clock;
        // the confetti drifts more than the plates.
        gsap.utils.toArray<HTMLElement>(".hm-layer").forEach((layer, i) => {
          const d = Number(layer.dataset.depth ?? 1);
          gsap.to(layer.querySelector(".hm-float"), {
            y: -(3 + d * 5),
            rotation: (i % 2 ? 1 : -1) * d * 1.2,
            duration: 3 + (i % 4) * 0.5,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: 1.5 + (i % 5) * 0.2,
          });
        });

        // As the hero scrolls away the two sides part and lift.
        const part = (side: string, x: number) =>
          gsap.to(`.hm-side[data-side='${side}']`, {
            xPercent: x,
            yPercent: -8,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
          });
        part("left", -4);
        part("right", 4);

        return () => split.revert();
      });

      // The layers lean toward the pointer, each at its own depth.
      mm.add(`${motionQueries.full} and (hover: hover) and (pointer: fine)`, () => {
        const el = root.current;
        if (!el) return;
        const movers = gsap.utils.toArray<HTMLElement>(".hm-layer").map((layer) => {
          const tilt = layer.querySelector(".hm-tilt");
          return {
            d: Number(layer.dataset.depth ?? 1),
            x: gsap.quickTo(tilt, "x", { duration: 0.9, ease: "power3.out" }),
            y: gsap.quickTo(tilt, "y", { duration: 0.9, ease: "power3.out" }),
          };
        });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          movers.forEach((m) => {
            m.x(nx * 22 * m.d);
            m.y(ny * 16 * m.d);
          });
        };
        el.addEventListener("pointermove", move);
        return () => el.removeEventListener("pointermove", move);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="hm-hero relative overflow-hidden">
      <div className="hm-hero-art" aria-hidden>
        <Side side="left" />
        <Side side="right" />
      </div>

      <div className="relative mx-auto w-[min(1360px,calc(100%-32px))] lg:min-h-[640px]">
        <div className="relative z-20 mx-auto flex max-w-[620px] flex-col items-center text-center">
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
