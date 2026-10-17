"use client";

/**
 * <SplitReveal /> — GSAP reference pattern. Headline lines rise out of a mask.
 * Basket: use with Ozik only, e.g.
 *   <SplitReveal className="display text-display-xl lg:text-display-2xl">Fresh every week</SplitReveal>
 * Use for ONE hero headline per page (the page's orchestrated moment), not
 * every heading.
 *
 * Pattern every GSAP component in Ripe follows:
 *   1. import from "@/lib/motion/gsap" (plugins + brand eases registered)
 *   2. useGSAP with a `scope` ref → automatic cleanup on unmount
 *   3. gsap.matchMedia(motionQueries) → a calm branch for reduced motion
 *   4. SplitText autoSplit + return the tween from onSplit → safe re-split
 *      on resize / font load
 *   5. start hidden with CSS (`invisible`) and reveal via autoAlpha to avoid FOUC
 */

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, SplitText, useGSAP, motionQueries } from "@/lib/motion/gsap";
import { duration, gsapEase, stagger } from "@/lib/motion/tokens";
import { cn } from "@/lib/cn";

type Props = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  /** Start when scrolled into view instead of on mount. */
  onScroll?: boolean;
  delay?: number;
};

export function SplitReveal({ as: Tag = "h1", children, className, onScroll = false, delay = 0 }: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add(motionQueries, (ctx) => {
        const { full } = ctx.conditions as Record<keyof typeof motionQueries, boolean>;

        if (!full) {
          gsap.to(el, { autoAlpha: 1, duration: duration.base });
          return;
        }

        gsap.set(el, { autoAlpha: 1 });
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              rotate: 2,
              duration: duration.slower,
              ease: gsapEase.emphasized,
              stagger: stagger.loose,
              delay,
              scrollTrigger: onScroll ? { trigger: el, start: "top 85%", once: true } : undefined,
            }),
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={cn("invisible", className)}>
      {children}
    </Tag>
  );
}
