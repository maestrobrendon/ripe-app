"use client";

/**
 * <StreakRing /> — a ring that draws in to show progress toward the next
 * streak milestone (M17). Server-renders at its final position; GSAP redraws
 * it from empty the first time it scrolls into view.
 */

import { useRef } from "react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { duration, gsapEase } from "@/lib/motion/tokens";

const SIZE = 64;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function StreakRing({
  progress,
  label,
}: {
  /** 0 to 1. */
  progress: number;
  label: string;
}) {
  const circleRef = useRef<SVGCircleElement>(null);
  const clamped = Math.max(0, Math.min(1, progress));
  const finalOffset = CIRCUMFERENCE * (1 - clamped);

  useGSAP(
    () => {
      const el = circleRef.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(motionQueries, (ctx) => {
        const { full } = ctx.conditions as Record<string, boolean>;
        if (!full) return;
        gsap.fromTo(
          el,
          { strokeDashoffset: CIRCUMFERENCE },
          {
            strokeDashoffset: finalOffset,
            duration: duration.story,
            ease: gsapEase.out,
            scrollTrigger: { trigger: el, start: "top 95%", once: true },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: circleRef, dependencies: [finalOffset] },
  );

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="shrink-0 -rotate-90">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--soft-mist)" strokeWidth={STROKE} />
      <circle
        ref={circleRef}
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--carbon)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={finalOffset}
      />
    </svg>
  );
}
