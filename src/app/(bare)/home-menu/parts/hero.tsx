"use client";

import Image from "next/image";
import { useRef, type CSSProperties } from "react";
import { gsap, SplitText, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { MagneticLink } from "../../home-next/parts/runtime";

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

/** What each layer is decides how it moves. */
type Role = "plate" | "bowl" | "hand" | "lime" | "flecks";

/**
 * origin is the point a layer turns about: the plates turn about their own
 * centres (the salad's is off the edge of its crop), the hand about its wrist.
 *
 * cut names the sides (l, r, t, b) where the source image cropped the
 * object, leaving a straight edge. Those sides sit --bleed beyond the hero's
 * edge, and every motion below either moves them outward or stays smaller
 * than the bleed, so a cut edge never shows.
 */
type Layer = {
  name: string;
  role: Role;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  origin?: string;
  cut?: string;
  preload?: boolean;
};

const LAYERS: Layer[] = [
  { name: "salad", role: "plate", x: 0, y: 459, w: 493, h: 565, depth: 0.5, origin: "-7% 89%", cut: "lb", preload: true },
  { name: "shawarma", role: "plate", x: 1031, y: 0, w: 505, h: 556, depth: 0.5, origin: "60% 26%", cut: "tr", preload: true },
  { name: "hand", role: "hand", x: 1218, y: 668, w: 318, h: 356, depth: 0.9, origin: "92% 69%", cut: "rb", preload: true },
  { name: "yoghurt", role: "bowl", x: -50, y: -40, w: 288, h: 223, depth: 0.7, cut: "t" },
  { name: "chilli", role: "bowl", x: 840, y: 830, w: 206, h: 205, depth: 0.8 },
  { name: "lime-left", role: "lime", x: 4, y: 181, w: 168, h: 161, depth: 1.3 },
  { name: "lime-right", role: "lime", x: 1403, y: 533, w: 133, h: 134, depth: 1.4, cut: "r" },
  { name: "lime-bottom", role: "lime", x: 1148, y: 898, w: 171, h: 126, depth: 1.2, cut: "b" },
  { name: "flecks-tl", role: "flecks", x: 10, y: 17, w: 217, h: 420, depth: 1.7 },
  { name: "flecks-tr", role: "flecks", x: 822, y: 147, w: 435, h: 261, depth: 1.7 },
  { name: "flecks-br", role: "flecks", x: 1004, y: 511, w: 519, h: 467, depth: 1.7 },
];

/**
 * How each role turns (degrees, for a layer on the right; the left mirrors
 * it) and how far it travels out toward its own corner (percent of its size)
 * while the hero scrolls away: the plates turn like a turntable, the limes
 * spin, the herbs scatter, the hand withdraws. Each role travels further
 * than its turn could swing a cut edge into view; a cut layer whose role
 * turns more than CUT_TURN (a cropped lime would otherwise spin) turns only
 * that much and travels at least CUT_TRAVEL.
 */
const ON_SCROLL: Record<Role, { rotation: number; travel: number }> = {
  plate: { rotation: 6, travel: 14 },
  bowl: { rotation: 12, travel: 12 },
  lime: { rotation: 110, travel: 22 },
  flecks: { rotation: 0, travel: 26 },
  hand: { rotation: 10, travel: 24 },
};
const CUT_TURN = 8;
const CUT_TRAVEL = 40;

const isLeft = (l: Layer) => l.x + l.w / 2 < SRC_W / 2;
const isTop = (l: Layer) => l.y + l.h / 2 < SRC_H / 2;

function place(l: Layer): CSSProperties {
  const left = isLeft(l);
  const top = isTop(l);
  const bleed = (side: string) => (l.cut?.includes(side) ? " - var(--bleed)" : "");
  return {
    "--o": l.origin ?? "50% 50%",
    width: `calc(${l.w} * var(--s))`,
    [left ? "left" : "right"]: `calc(${left ? l.x : SRC_W - l.x - l.w} * var(--s) - var(--push)${bleed(left ? "l" : "r")})`,
    [top ? "top" : "bottom"]: `calc(${top ? `${l.y} * var(--s) + var(--nav)` : `${SRC_H - l.y - l.h} * var(--s)`}${bleed(top ? "t" : "b")})`,
  } as CSSProperties;
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
        <div key={l.name} data-intro data-role={l.role} data-cut={l.cut} data-w={l.w} data-depth={l.depth} data-from={`${isLeft(l) ? -1 : 1},${isTop(l) ? -1 : 1}`} className="hm-layer" style={place(l)}>
          <div className="hm-tilt">
            <div className="hm-float">
              <Image
                src={`/assets/illustrations/hero/layers/${l.name}.webp`}
                alt=""
                width={l.w}
                height={l.h}
                sizes={sizes(l)}
                // All of them are in the first screen: lazy loading would hold
                // the small ones back until after the intro has played.
                {...(l.preload ? { preload: true } : { loading: "eager" as const })}
                draggable={false}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Hero({ signedIn }: { signedIn: boolean }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        const split = SplitText.create(".hm-hero-title", { type: "lines,words", mask: "lines" });
        gsap.set("[data-intro]", { visibility: "visible" });

        const layers = gsap.utils.toArray<HTMLElement>(".hm-layer");
        const role = (r: Role) => layers.filter((l) => l.dataset.role === r);
        // Which way is "out" for a layer, toward its own corner: x is -1 on
        // the left, 1 on the right; y is -1 at the top, 1 at the bottom.
        const out = (el: Element) => (el as HTMLElement).dataset.from!.split(",").map(Number);
        const isCut = (el: Element) => Boolean((el as HTMLElement).dataset.cut);
        // Idle moves are written in source px and scaled to the screen, so
        // they stay inside the bleed on a phone as on a desktop.
        const px = (el: HTMLElement) => el.offsetWidth / Number(el.dataset.w);
        const float = (el: HTMLElement) => el.querySelector<HTMLElement>(".hm-float")!;

        // The table is set: the plates slide in from their corners, the bowls
        // are put down from above, a hand reaches in, and the limes and herbs
        // are tossed on last.
        const tl = gsap.timeline({ defaults: { ease: "ripe.out" } });
        tl.from(split.words, { yPercent: 115, duration: 1, stagger: 0.06 }, 0.1)
          .from("[data-hero-fade]", { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.08 }, 0.5)
          .from(
            role("plate"),
            {
              autoAlpha: 0,
              x: (_, el) => out(el)[0] * 140,
              y: (_, el) => out(el)[1] * 90,
              rotation: (_, el) => out(el)[0] * 6,
              duration: 1.5,
              stagger: 0.12,
            },
            0.1,
          )
          .from(role("bowl"), { autoAlpha: 0, scale: 1.14, y: -12, duration: 0.9, ease: "ripe.emphasized", stagger: 0.16 }, 0.55)
          .from(role("hand"), { autoAlpha: 0, x: 170, y: 120, rotation: 12, duration: 1.3, ease: "ripe.emphasized" }, 0.85)
          // A whole lime tumbles in; a cropped one slides in from past its edge.
          .from(
            role("lime"),
            {
              autoAlpha: 0,
              scale: (_, el) => (isCut(el) ? 1 : 0.6),
              x: (_, el) => out(el)[0] * (isCut(el) ? 90 : 50),
              y: (_, el) => out(el)[1] * (isCut(el) ? 70 : 40),
              rotation: (i, el) => (isCut(el) ? out(el)[0] * 6 : (i % 2 ? 1 : -1) * 150),
              duration: 1.1,
              stagger: 0.09,
            },
            1.05,
          )
          .from(role("flecks"), { autoAlpha: 0, scale: 0.9, duration: 1.2, stagger: 0.1 }, 1.2);

        // Once everything has landed, each thing moves like itself: the
        // plates drift about their centres, the bowls bob, the limes rock,
        // the herbs wander, each on its own clock. Drifts go outward from
        // rest, toward the layer's corner, never in toward the copy.
        const idle = { ease: "sine.inOut", yoyo: true, repeat: -1 };
        role("plate").forEach((l, i) =>
          gsap.to(float(l), { ...idle, rotation: i ? 1 : -1, y: out(l)[1] * 5 * px(l), duration: 7 + i * 1.5, delay: 2 }),
        );
        role("bowl").forEach((l, i) =>
          gsap.to(float(l), { ...idle, rotation: i ? 2.5 : -2.5, y: out(l)[1] * 7 * px(l), duration: 3.6 + i * 0.8, delay: 2.2 + i * 0.3 }),
        );
        role("lime").forEach((l, i) =>
          gsap.to(float(l), { ...idle, rotation: i % 2 ? 9 : -9, y: out(l)[1] * 9 * px(l), duration: 3 + i * 0.6, delay: 2.4 + i * 0.25 }),
        );
        role("flecks").forEach((l, i) =>
          gsap.to(float(l), { ...idle, x: (i % 2 ? 6 : -6) * px(l), y: out(l)[1] * 12 * px(l), duration: 4.5 + i * 0.7, delay: 2.4 + i * 0.3 }),
        );

        // The hand leans in over the food, gives the lime two squeezes and
        // settles back, every few seconds.
        role("hand").forEach((l) =>
          gsap
            .timeline({ repeat: -1, repeatDelay: 2.2, delay: 2.6 })
            .to(float(l), { x: -14 * px(l), y: -9 * px(l), rotation: -3, duration: 1.4, ease: "sine.inOut" })
            .to(float(l), { rotation: "-=2", duration: 0.16, ease: "power2.inOut", yoyo: true, repeat: 3 })
            .to(float(l), { x: 0, y: 0, rotation: 0, duration: 1.8, ease: "sine.inOut" }),
        );

        // As the hero scrolls away every layer turns and travels out toward
        // its own corner, by its role (ON_SCROLL), so the scene opens up.
        layers.forEach((layer) => {
          const s = ON_SCROLL[layer.dataset.role as Role];
          const [ox, oy] = out(layer);
          const clamp = isCut(layer) && s.rotation > CUT_TURN;
          const turn = clamp ? CUT_TURN : s.rotation;
          const travel = clamp ? Math.max(s.travel, CUT_TRAVEL) : s.travel;
          gsap.to(layer.querySelector(".hm-tilt"), {
            rotation: turn * ox,
            xPercent: travel * ox,
            yPercent: travel * oy,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
          });
        });

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
          {/* Four hand-set lines, sized to the column (see .hm-hero-title):
              no line ever wraps on its own, at any width. One plain sentence:
              what Basket is, and nothing a first visit has to decide. */}
          <div className="hm-hero-title-box w-full">
            <h1 className="hm-hero-title hm-display">
              Fresh fruit
              <br />
              and veg,
              <br />
              delivered
              <br />
              every week.
            </h1>
          </div>

          <p data-intro data-hero-fade className="hm-lede mt-6 max-w-[30rem]">
            Pick what you like and your day. It keeps coming, with recipes so you actually eat it.
          </p>

          <div data-intro data-hero-fade className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <MagneticLink href={signedIn ? "/basket" : "/start"} arrow>
              {signedIn ? "Open your basket" : "Try your first basket"}
            </MagneticLink>
            <MagneticLink href="#menu" variant="soft">
              See this week&apos;s recipes
            </MagneticLink>
          </div>
        </div>
      </div>
    </section>
  );
}
