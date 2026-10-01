"use client";

import Link from "next/link";
import Lenis from "lenis";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap, ScrollTrigger, useGSAP, motionQueries } from "@/lib/motion/gsap";

/* -------------------------------------------------------------------------- */
/* Smooth scroll                                                              */
/* -------------------------------------------------------------------------- */

let lenis: Lenis | null = null;

/** Scrolls to a section by id, smoothly when Lenis is running. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -64, duration: 1.2 });
  else el.scrollIntoView({ behavior: "auto", block: "start" });
}

/** Scrolls to an absolute page position, smoothly when Lenis is running. */
export function scrollToY(y: number) {
  if (lenis) lenis.scrollTo(y, { duration: 1 });
  else window.scrollTo({ top: y, behavior: "auto" });
}

/**
 * Lenis drives the page, ScrollTrigger listens to it, and GSAP's ticker is
 * the one clock for both. With reduced motion none of it starts: the page
 * scrolls natively and every section renders in its final state.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia(motionQueries.reduced).matches;
    root.current?.classList.toggle("hn-reduced", reduced);
    if (reduced) return;

    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const id = a?.getAttribute("href")?.slice(1);
      if (!id) return;
      e.preventDefault();
      scrollToId(id);
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  return (
    <div ref={root} className="hn">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reveal                                                                     */
/* -------------------------------------------------------------------------- */

/** Rises and fades in the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  stagger,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  /** Animate direct children one after another instead of the block as one. */
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(motionQueries.full, () => {
        gsap.from(stagger ? el.children : el, {
          autoAlpha: 0,
          y,
          duration: 0.9,
          delay,
          stagger,
          ease: "ripe.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`h-4.5 w-4.5 transition-transform duration-(--dur-base) ease-(--ease-emphasized) group-hover:translate-x-1 ${className}`}
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

const VARIANT = {
  dark: "bg-carbon text-paper-white",
  ghost: "bg-transparent text-carbon border border-carbon",
  light: "bg-paper-white text-carbon border border-carbon",
} as const;

const SIZE = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-6.5 text-base",
} as const;

/**
 * A pill button that leans toward the pointer and springs back when it
 * leaves. Only on a fine pointer with motion allowed; everywhere else it is
 * a plain link.
 */
export function MagneticLink({
  href,
  children,
  variant = "dark",
  size = "lg",
  className = "",
  arrow = false,
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  className?: string;
  arrow?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.22);
      yTo((e.clientY - r.top - r.height / 2) * 0.32);
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.4)" });
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  const cls = `group relative inline-flex shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-semibold will-change-transform active:scale-[0.97] transition-[transform,background-color] duration-(--dur-fast) ${VARIANT[variant]} ${SIZE[size]} ${className}`;
  const inner = (
    <>
      {children}
      {arrow && <Arrow />}
    </>
  );

  return href.startsWith("#") ? (
    <a ref={ref} href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link ref={ref} href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** Small label above a headline, with a sticker dot. */
export function Kicker({ children, dot = "bg-mint-pop", className = "" }: { children: ReactNode; dot?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.02em] ${className}`}>
      <i className={`h-2.5 w-2.5 rounded-full border border-carbon ${dot}`} aria-hidden />
      {children}
    </span>
  );
}
