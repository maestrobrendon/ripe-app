"use client";

/**
 * <CountUp /> — a stat that counts up from 0 the first time it scrolls into
 * view (M18). Server-renders the final value so there's no layout shift and
 * no-JS users see the number immediately; GSAP only replaces it client-side.
 */

import { useRef } from "react";
import { gsap, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { duration, gsapEase, prefersLiteMotion } from "@/lib/motion/tokens";
import { formatNaira } from "@/lib/format";

/**
 * `format` is a named formatter, not a function prop: a Server Component
 * can't pass a plain function to a Client Component (it isn't serializable
 * across the boundary), and CountUp's server-rendered callers (account page,
 * streak card) are Server Components. Add a case here rather than widening
 * this back to `(n: number) => string`.
 */
const FORMATTERS = {
  naira: formatNaira,
  weeks: (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`,
  plain: (n: number) => String(n),
} as const;

export type CountUpFormat = keyof typeof FORMATTERS;

export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: CountUpFormat;
  className?: string;
}) {
  const formatter = FORMATTERS[format];
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(motionQueries, (ctx) => {
        const { full } = ctx.conditions as Record<string, boolean>;
        if (!full || prefersLiteMotion()) {
          el.textContent = formatter(value);
          return;
        }
        const state = { v: 0 };
        gsap.to(state, {
          v: value,
          duration: duration.story,
          ease: gsapEase.out,
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
          onUpdate: () => {
            el.textContent = formatter(Math.round(state.v));
          },
        });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [value] },
  );

  return (
    <span ref={ref} data-numeric className={className}>
      {formatter(value)}
    </span>
  );
}
