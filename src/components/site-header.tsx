"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion, useAnimate } from "motion/react";
import { useCart } from "@/components/cart-provider";
import { SearchBar } from "@/components/search-bar";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Icon } from "@/components/ui/icon";
import { RollingNumber } from "@/components/ui/rolling-number";
import { CART_LANDED_EVENT } from "@/components/ui/fly-to-cart";
import { press, spring } from "@/lib/motion/tokens";
import { SITE_NAME } from "@/lib/site";

// Icon-only controls still need an accessible name, so every use passes both
// aria-label and title: the first for screen readers, the second for hover.
// Matches the marketing nav's soft pills (it sits inside that header).
const ICON_BUTTON =
  "tap-target flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hm-tint)] text-carbon transition-colors hover:bg-[var(--hm-tint-2)]";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const cart = useCart();
  const isSignedIn = signedIn;
  // Nothing to search on the chat or account screens.
  const showSearch = !pathname.startsWith("/assistant") && !pathname.startsWith("/account");

  // Every signed-in page gets the same slim header: the wordmark (Home),
  // search, and Ask Kachi spelled out. No cart: the customer's order is Home,
  // one tap away in the dock. Search is a full field on desktop and a button
  // to the search page on phones, so Home isn't pushed below the fold.
  if (isSignedIn) {
    // On phones the Kachi screen has the whole height to itself, so the bar
    // stays off there until desktop. Everywhere else it's as it always was.
    const onKachi = pathname.startsWith("/assistant");
    return (
      <header className={`sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-xl backdrop-saturate-150 ${onKachi ? "hidden lg:block" : ""}`}>
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-0">
          {/* On desktop the wordmark sits over the sidebar, and the rest lines up with the page. */}
          <div className="shrink-0 lg:w-60 lg:px-6">
            <Link href="/basket" className="logo-wordmark text-2xl text-carbon">
              {SITE_NAME}
            </Link>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:pr-6 lg:pl-6">
          <div className="flex-1">{showSearch && <div className="hidden max-w-md lg:block"><SearchBar compact /></div>}</div>
          {showSearch && (
            <Link href="/search" aria-label="Search produce and recipes" title="Search" className={`${ICON_BUTTON} lg:hidden`}>
              <Icon name="search" size={20} />
            </Link>
          )}
          {!pathname.startsWith("/assistant") && (
            <Link href="/assistant" className="flex h-10 items-center gap-1.5 rounded-full bg-[var(--hm-tint)] px-3.5 text-sm font-semibold text-carbon transition-colors hover:bg-[var(--hm-tint-2)]">
              <Icon name="assistant" size={18} />
              Ask Kachi
            </Link>
          )}
          </div>
        </div>
      </header>
    );
  }

  // A signed-out visitor gets the same navigation as the homepage, plus the
  // cart, since anyone can shop produce without an account.
  return <MarketingNav variant="page" cart={<HeaderCartButton count={cart.itemCount} onOpen={cart.openDrawer} />} />;
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
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember px-1 text-xs font-semibold text-paper-white">
          <RollingNumber value={count} />
        </span>
      )}
    </motion.button>
  );
}
