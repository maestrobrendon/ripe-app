"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MagneticLink } from "../../home-next/parts/runtime";

const LINKS = [
  ["Menu", "#menu"],
  ["How it works", "#how"],
  ["Pricing", "#price"],
  ["Questions", "#faq"],
] as const;

export function Nav({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-(--z-header) transition-[background-color,box-shadow] duration-(--dur-slow) ${
        // At the top it's the hero's sky colour on phones and tablets, a bar
        // the illustration tucks under (see .hm-hero), and clear on desktop.
        scrolled ? "bg-paper-white/90 shadow-[0_1px_0_var(--hm-line)] backdrop-blur-md" : "bg-[#d1eafd] lg:bg-transparent"
      }`}
    >
      <div className="hm-wrap flex h-16 items-center justify-between gap-4 sm:h-18">
        <Link href="/" className="logo-wordmark text-[24px] leading-none" aria-label="Basket, home">
          Basket
        </Link>

        <nav className="hidden items-center gap-1 text-[15px] font-medium md:flex" aria-label="Sections">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="rounded-full px-3.5 py-2 text-carbon/75 transition-colors hover:bg-[#f3f5f0] hover:text-carbon">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!signedIn && (
            <Link href="/login" className="hidden h-10 items-center rounded-full bg-[#f3f5f0] px-4 text-[14px] font-semibold transition-colors hover:bg-[#e8ede3] sm:inline-flex">
              Sign in
            </Link>
          )}
          <MagneticLink href={signedIn ? "/basket" : "/start"} size="md" className="h-10! px-4.5! text-[14px]!">
            {signedIn ? "Open your basket" : "Get started"}
          </MagneticLink>
        </div>
      </div>
    </header>
  );
}
