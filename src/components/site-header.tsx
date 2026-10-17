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
