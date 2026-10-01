"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { MagneticLink } from "./runtime";

const LINKS = [
  ["How it works", "#how"],
  ["Baskets", "#goals"],
  ["Pricing", "#price"],
  ["Questions", "#faq"],
] as const;

/** Where the header "reads" what is behind it: the middle of its own bar. */
const PROBE_Y = 32;

export function Nav({ signedIn }: { signedIn: boolean }) {
  const [tight, setTight] = useState(false);
  // Over a dark section the header turns dark too, rather than a grey film.
  const [dark, setDark] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 260, damping: 40, mass: 0.4 });

  useEffect(() => {
    const onScroll = () => {
      setTight(window.scrollY > 60);
      const under = Array.from(document.querySelectorAll("[data-nav-dark]")).some((el) => {
        const r = el.getBoundingClientRect();
        return r.top <= PROBE_Y && r.bottom >= PROBE_Y;
      });
      setDark(under);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const surface = !tight
    ? "bg-transparent text-carbon"
    : dark
      ? "bg-carbon/80 text-paper-white shadow-[0_1px_0_rgb(255_255_255/0.14)] backdrop-blur-md"
      : "bg-paper-white/85 text-carbon shadow-[0_1px_0_var(--carbon)] backdrop-blur-md";

  return (
    <header className={`fixed inset-x-0 top-0 z-(--z-header) transition-[background-color,color,box-shadow] duration-(--dur-slow) ${surface}`}>
      <div
        className={`mx-auto flex w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4 transition-[height] duration-(--dur-slow) ease-(--ease-emphasized) sm:w-[min(1180px,calc(100%-48px))] ${
          tight ? "h-16" : "h-18 sm:h-21"
        }`}
      >
        <Link href="/" className="logo-wordmark text-[26px] leading-none" aria-label="Basket, home">
          Basket
        </Link>

        <nav className="hidden items-center gap-8 text-[15px] font-medium md:flex" aria-label="Sections">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="group relative py-1">
              {label}
              <span className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left scale-x-0 bg-current transition-transform duration-(--dur-base) ease-(--ease-emphasized) group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 sm:gap-5">
          {!signedIn && (
            <Link href="/login" className="hidden text-[15px] font-semibold sm:inline">
              Sign in
            </Link>
          )}
          <MagneticLink href={signedIn ? "/basket" : "/start"} size="md" variant={tight && dark ? "light" : "dark"}>
            {signedIn ? "Open your basket" : "Get Started"}
          </MagneticLink>
        </div>
      </div>

      {/* How far down the story you are. */}
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-ember transition-opacity duration-(--dur-base) ${tight ? "opacity-100" : "opacity-0"}`}
      />
    </header>
  );
}
