"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion, useAnimate } from "motion/react";
import { useCart } from "@/components/cart-provider";
import { SearchBar } from "@/components/search-bar";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RollingNumber } from "@/components/ui/rolling-number";
import { CART_LANDED_EVENT } from "@/components/ui/fly-to-cart";
import { press, spring } from "@/lib/motion/tokens";
import { SITE_NAME } from "@/lib/site";

const NAV = [
  { href: "/fruits", label: "Fruits" },
  { href: "/recipes", label: "Recipes" },
  { href: "/boxes-baskets", label: "Boxes & Baskets" },
  { href: "/fresh-cuts", label: "Fresh Cuts" },
];

// Icon-only controls still need an accessible name, so every use passes both
// aria-label and title: the first for screen readers, the second for hover.
const ICON_BUTTON =
  "tap-target flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-sky-wash";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const cart = useCart();
  const isSignedIn = signedIn;
  // Nothing to search on the chat or account screens.
  const showSearch = !pathname.startsWith("/assistant") && !pathname.startsWith("/account");

  // On the landing page the header shares the hero's band colour and drops its
  // divider, so nav and hero read as a single unbroken field.
  const onHero = pathname === "/";

  // Every signed-in page gets the same stripped-down header: wordmark, cart,
  // search. No category row (the floating dock is the one nav, and it
  // already covers Recipes/Kachi/Account) and no avatar (Account is its own
  // destination in the dock). Cart is its own screen here, not the slide-out
  // drawer — one header design for the whole signed-in app, not one per page.
  if (isSignedIn) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pt-3 pb-3 sm:px-6">
          <div className={`flex h-11 items-center justify-between ${showSearch ? "mb-3" : ""}`}>
            <Link href="/basket" className="logo-wordmark text-2xl text-carbon">
              {SITE_NAME}
            </Link>
            <Link
              href="/cart"
              aria-label={cart.itemCount > 0 ? `Cart, ${cart.itemCount} items` : "Cart"}
              className="flex h-11 items-center gap-2 rounded-full bg-soft-mist pl-3 pr-4 text-sm font-semibold"
            >
              <Icon name="cart" size={20} />
              Cart
              {cart.itemCount > 0 && (
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-ember px-1 text-xs font-medium text-white">
                  <RollingNumber value={cart.itemCount} />
                </span>
              )}
            </Link>
          </div>
          {showSearch && <SearchBar compact />}
        </div>
      </header>
    );
  }

  // Only a signed-out visitor reaches this branch now, so the marketing
  // header never needs to account for a member state.
  return (
    <header
      className={`sticky top-0 z-40 ${
        onHero ? "bg-sky-wash" : "border-b border-border bg-background/95 backdrop-blur"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Row one: brand, search, account actions */}
        <div className="flex items-center gap-3 py-3 sm:gap-4">
          <Link href="/" className="logo-wordmark shrink-0 text-2xl text-carbon">
            {SITE_NAME}
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-border lg:block" />
          <span className="hidden shrink-0 text-sm text-muted lg:block">Produce, delivered</span>

          <div className="hidden flex-1 md:block md:max-w-xl">
            <SearchBar compact />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <Link href="/login" aria-label="Sign in" title="Sign in" className={ICON_BUTTON}>
              <Icon name="account" size={22} />
            </Link>

            <HeaderCartButton count={cart.itemCount} onOpen={cart.openDrawer} />

            <LinkButton href="/start" size="sm">
              Get started
            </LinkButton>
          </div>
        </div>

        {/* Phones get the search field on its own line rather than a cramped row */}
        <div className="pb-3 md:hidden">
          <SearchBar compact />
        </div>

        {/* Row two: the category nav, scrollable on narrow screens */}
        <nav className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 text-sm ${
                pathname === link.href
                  ? "font-semibold text-carbon"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** The landing target for flyToCart(); does a small "gulp" when produce lands. */
function HeaderCartButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  const [scope, animate] = useAnimate();

  useEffect(() => {
    const gulp = () => {
      animate(scope.current, { scale: [1, 0.86, 1.08, 1] }, { duration: 0.42, times: [0, 0.25, 0.6, 1] });
    };
    window.addEventListener(CART_LANDED_EVENT, gulp);
    return () => window.removeEventListener(CART_LANDED_EVENT, gulp);
  }, [animate, scope]);

  return (
    <motion.button
      ref={scope}
      data-flight-target="cart"
      onClick={onOpen}
      whileTap={{ scale: press.scale }}
      transition={spring.snappy}
      aria-label={count > 0 ? `Open cart, ${count} items` : "Open cart"}
      title="Cart"
      className={`${ICON_BUTTON} relative`}
    >
      <Icon name="cart" size={22} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-carbon bg-ember px-1 text-xs font-medium text-carbon">
          <RollingNumber value={count} />
        </span>
      )}
    </motion.button>
  );
}
