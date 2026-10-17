"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MagneticLink, setScrollLocked } from "@/app/(bare)/home-next/parts/runtime";
import "@/app/(bare)/home-menu/home-menu.css";

/**
 * The one navigation a signed-out visitor sees, on the homepage and on every
 * page they can reach from it (recipes, produce and prices, pricing), so the
 * site reads as one place rather than a landing page bolted onto a shop.
 * Signed-in members get the app's own header and dock instead.
 *
 * "How it works" and "Questions" are homepage sections; from any other page
 * they go back to that section.
 */
export const MARKETING_LINKS: { label: string; href: string }[] = [
  { label: "Recipes", href: "/recipes" },
  { label: "Fruits", href: "/shop" },
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/subscribe" },
  { label: "Questions", href: "/#faq" },
];

export function MarketingNav({
  variant,
  signedIn = false,
  cart,
}: {
  /** "home" floats over the homepage hero; "page" is a plain sticky bar. */
  variant: "home" | "page";
  signedIn?: boolean;
  /** The cart button, on pages where a guest can add to a cart. */
  cart?: ReactNode;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (variant !== "home") return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  // The phone menu covers the page, so the page behind it shouldn't scroll.
  useEffect(() => {
    if (!open) return;
    setScrollLocked(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      setScrollLocked(false);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isCurrent = (href: string) => !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));
  const solid = variant === "page" || scrolled || open;

  const linkFor = (l: { label: string; href: string }, cls: string) =>
    l.href.includes("#") ? (
      // A hash link stays a plain anchor: on the homepage it scrolls, from
      // anywhere else it loads the homepage at that section.
      <a key={l.href} href={pathname === "/" ? l.href.slice(1) : l.href} className={cls} onClick={() => setOpen(false)}>
        {l.label}
      </a>
    ) : (
      <Link key={l.href} href={l.href} aria-current={isCurrent(l.href) ? "page" : undefined} className={cls} onClick={() => setOpen(false)}>
        {l.label}
      </Link>
    );

  return (
    <header
      className={`hm inset-x-0 top-0 z-(--z-header) transition-[background-color,box-shadow] duration-(--dur-slow) ${variant === "home" ? "fixed" : "sticky"} ${
        solid
          ? "bg-paper-white/92 shadow-[0_1px_0_var(--hm-line)] backdrop-blur-md"
          : // Over the homepage hero: its sky on phones and tablets, a bar the
            // illustration tucks under (see .hm-hero), and clear on desktop.
            "bg-[#d1eafd] lg:bg-transparent"
      }`}
    >
      <div className="hm-wrap flex h-16 items-center justify-between gap-3 sm:h-18">
        <Link href="/" className="logo-wordmark text-[24px] leading-none" aria-label="Basket, home">
          Basket
        </Link>

        <nav className="hidden items-center gap-0.5 text-[15px] font-medium lg:flex" aria-label="Main">
          {MARKETING_LINKS.map((l) =>
            linkFor(
              l,
              `rounded-full px-3.5 py-2 transition-colors hover:bg-[var(--hm-tint)] hover:text-carbon ${isCurrent(l.href) ? "text-carbon font-semibold" : "text-carbon/70"}`,
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          {cart}
          {!signedIn && (
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-full bg-[var(--hm-tint)] px-4 text-[14px] font-semibold transition-colors hover:bg-[var(--hm-tint-2)] sm:inline-flex"
            >
              Sign in
            </Link>
          )}
          <MagneticLink href={signedIn ? "/basket" : "/start"} size="md" className="h-10! px-4.5! text-[14px]!">
            {signedIn ? "Open your basket" : "Get started"}
          </MagneticLink>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="marketing-menu"
            aria-label={open ? "Close the menu" : "Open the menu"}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--hm-tint)] lg:hidden"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3.5 6.5h13M3.5 13.5h13" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div id="marketing-menu" className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-[var(--hm-line)] bg-paper-white sm:h-[calc(100dvh-4.5rem)] lg:hidden">
          <nav className="hm-wrap flex flex-col py-4" aria-label="Main">
            {MARKETING_LINKS.map((l) =>
              linkFor(l, `flex h-14 items-center justify-between border-b border-[var(--hm-line)] text-[19px] font-semibold tracking-[-0.02em] ${isCurrent(l.href) ? "text-carbon" : "text-carbon/85"}`),
            )}
            {!signedIn && (
              <div className="mt-8 grid gap-3">
                <Link href="/start" onClick={() => setOpen(false)} className="flex h-13 items-center justify-center rounded-full bg-carbon text-[15px] font-semibold text-paper-white">
                  Get started
                </Link>
                <Link href="/login" onClick={() => setOpen(false)} className="flex h-13 items-center justify-center rounded-full bg-[var(--hm-tint)] text-[15px] font-semibold">
                  Sign in
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
