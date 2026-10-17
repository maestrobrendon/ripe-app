/**
 * RIPE · MOTION TOKENS (JS side)
 * ---------------------------------------------------------------------------
 * Single source of truth for Motion (motion/react) and GSAP. Mirrors
 * src/styles/tokens/motion.css + the --ease-* values in semantic.css.
 *
 * Library roles — do not mix on the same element/property:
 *   CSS    → hover + colour micro-states only
 *   Motion → anything a finger touches: press, drag, layout, presence, springs
 *   GSAP   → choreography: timelines, ScrollTrigger, SplitText, Flip, DrawSVG
 *
 * Personality: "juicy, never jelly". Things feel like pressing ripe fruit —
 * a soft give on press, a confident settle. Bounce ONLY when the user's
 * gesture carried momentum (flick, throw) or on a celebration moment.
 */

import type { Transition } from "motion/react";

/* ---------------------------------- time ---------------------------------- */

/** Seconds (Motion + GSAP both use seconds). */
export const duration = {
  instant: 0.08,
  fast: 0.16,
  base: 0.24,
  slow: 0.36,
  slower: 0.52,
  story: 0.9,
} as const;

/** Stagger between siblings (seconds). Cap list staggers at ~8 items. */
export const stagger = {
  tight: 0.03,
  base: 0.05,
  loose: 0.08,
} as const;

/* --------------------------------- easing --------------------------------- */

/** Cubic-bezier control points. Same numbers as the CSS --ease-* tokens. */
export const bezier = {
  out: [0.22, 1, 0.36, 1],
  in: [0.55, 0, 1, 0.45],
  inOut: [0.65, 0, 0.35, 1],
  emphasized: [0.2, 0, 0, 1],
  juicy: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** GSAP ease names, registered via CustomEase in ./gsap.ts */
export const gsapEase = {
  out: "ripe.out",
  in: "ripe.in",
  inOut: "ripe.inOut",
  emphasized: "ripe.emphasized",
  juicy: "ripe.juicy",
} as const;

/* --------------------------------- springs --------------------------------
 * Motion's { visualDuration, bounce } ≈ Apple's { response, dampingRatio }.
 * bounce 0 = critically damped (default). Only add bounce with momentum.
 * -------------------------------------------------------------------------- */

export const spring = {
  /** Press / release, toggles, small UI. The workhorse. */
  snappy: { type: "spring", visualDuration: 0.22, bounce: 0 },
  /** Repositioning, layout changes, reorder, accordions. */
  smooth: { type: "spring", visualDuration: 0.38, bounce: 0 },
  /** Sheets, drawers, dialogs arriving. Tiny settle. */
  sheet: { type: "spring", visualDuration: 0.34, bounce: 0.12 },
  /** Dock active pill & tab indicators sliding. */
  indicator: { type: "spring", visualDuration: 0.3, bounce: 0.18 },
  /** After a flick/throw, or success celebrations (added to cart, streak). */
  juicy: { type: "spring", visualDuration: 0.42, bounce: 0.32 },
  /** Numbers rolling (price, quantity, badge count). */
  number: { type: "spring", visualDuration: 0.3, bounce: 0.05 },
} as const satisfies Record<string, Transition>;

/* ------------------------------ tween presets ----------------------------- */

export const tween = {
  fadeIn: { duration: duration.base, ease: bezier.out },
  fadeOut: { duration: duration.fast, ease: bezier.in },
  move: { duration: duration.slow, ease: bezier.inOut },
} as const satisfies Record<string, Transition>;

/* ------------------------------ interaction ------------------------------- */

/** The press "squish". Pointer-DOWN feedback, never on click/release. */
export const press = {
  scale: 0.96,
  /** larger surfaces squish less so they don't look like they're collapsing */
  scaleLarge: 0.985,
  y: 1,
} as const;

/** Hover lift for pointer devices only (gate with (hover:hover)). */
export const lift = { y: -2 } as const;

/** Gesture thresholds (px, px/s) */
export const gesture = {
  dragIntent: 10,         // hysteresis before a drag commits to a direction
  dismissVelocity: 600,   // flick speed that dismisses a sheet regardless of distance
  dismissFraction: 0.35,  // or dragged past this fraction of its height
  decelerationRate: 0.998,
} as const;

/** Apple's momentum projection — where a flick "wants" to land. */
export function projectMomentum(velocity: number, decelerationRate: number = gesture.decelerationRate) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary (drag over-scroll). */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/* ------------------------------ haptics ---------------------------------- */

/**
 * Tiny haptic tick for meaningful commits only (add to cart, snap, toggle).
 * Android Chrome supports it; iOS Safari ignores it silently.
 */
export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

/* ------------------------------ budget ----------------------------------- */

/**
 * Lagos context: many customers are on mid-range Android and metered data.
 * Respect Save-Data and low-end devices by dropping decorative motion
 * (parallax, particles, scroll-scrub). Interaction feedback always stays.
 */
export function prefersLiteMotion(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return true;
  return false;
}
