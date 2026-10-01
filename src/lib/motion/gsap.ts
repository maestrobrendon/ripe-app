"use client";

/**
 * RIPE · GSAP SETUP
 * ---------------------------------------------------------------------------
 * Import GSAP from HERE, never from "gsap" directly, so plugins + custom eases
 * are registered exactly once and every timeline shares the brand curves.
 *
 *   import { gsap, ScrollTrigger, useGSAP, motionQueries } from "@/lib/motion/gsap";
 *
 * GSAP owns: timelines, scroll choreography (ScrollTrigger), headline reveals
 * (SplitText), cross-layout flights (Flip), path drawing (DrawSVG,
 * MotionPath), number tweens. It never animates something Motion also
 * animates on the same element.
 */

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { bezier, duration, gsapEase } from "./tokens";

let registered = false;

function register() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(useGSAP, CustomEase, ScrollTrigger, SplitText, Flip, DrawSVGPlugin, MotionPathPlugin);

  const b = (p: readonly number[]) => p.join(",");
  CustomEase.create(gsapEase.out, b(bezier.out));
  CustomEase.create(gsapEase.in, b(bezier.in));
  CustomEase.create(gsapEase.inOut, b(bezier.inOut));
  CustomEase.create(gsapEase.emphasized, b(bezier.emphasized));
  CustomEase.create(gsapEase.juicy, b(bezier.juicy));

  gsap.defaults({ ease: gsapEase.out, duration: duration.base });
  // Keep ScrollTrigger honest on mobile URL-bar resize.
  ScrollTrigger.config({ ignoreMobileResize: true });
  registered = true;
}

register();

/**
 * Standard media conditions for gsap.matchMedia(). Every GSAP effect MUST
 * branch on these so reduced-motion users get a calm equivalent.
 *
 *   useGSAP(() => {
 *     const mm = gsap.matchMedia();
 *     mm.add(motionQueries, (ctx) => {
 *       const { full, reduced } = ctx.conditions!;
 *       if (full) { ...rich timeline... }
 *       if (reduced) { gsap.set(targets, { autoAlpha: 1 }); }
 *     });
 *   }, { scope: ref });
 */
export const motionQueries = {
  full: "(prefers-reduced-motion: no-preference)",
  reduced: "(prefers-reduced-motion: reduce)",
  desktop: "(min-width: 1024px)",
  touch: "(hover: none)",
} as const;

export { gsap, useGSAP, ScrollTrigger, SplitText, Flip, CustomEase };
