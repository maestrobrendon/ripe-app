"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { SearchBar } from "@/components/search-bar";
import { LinkButton } from "@/components/ui/button";
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
  "tap-target flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition hover:border-basket-green hover:bg-basket-green-light";

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function SiteHeader({ isSignedIn }: { isSignedIn: boolean }) {
  const pathname = usePathname();
  const cart = useCart();

  const links = isSignedIn ? [...NAV, { href: "/basket", label: "Basket" }] : NAV;

  // On the landing page the header shares the hero's band colour and drops its
  // divider, so nav and hero read as a single unbroken field.
  const onHero = pathname === "/";

  return (
    <header
      className={`sticky top-0 z-40 ${
        onHero ? "bg-basket-green-light" : "border-b border-border bg-background/95 backdrop-blur"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Row one: brand, search, account actions */}
        <div className="flex items-center gap-3 py-3 sm:gap-4">
          <Link href="/" className="text-heading-sm shrink-0 tracking-tight text-basket-green">
            {SITE_NAME}
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-border lg:block" />
          <span className="hidden shrink-0 text-sm text-muted lg:block">Produce, delivered</span>

          <div className="hidden flex-1 md:block md:max-w-xl">
            <SearchBar compact />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <Link
              href={isSignedIn ? "/account" : "/login"}
              aria-label={isSignedIn ? "Your account" : "Sign in"}
              title={isSignedIn ? "Your account" : "Sign in"}
              className={ICON_BUTTON}
            >
              <UserIcon />
            </Link>

            <button
              onClick={cart.openDrawer}
              aria-label={
                cart.itemCount > 0 ? `Open cart, ${cart.itemCount} items` : "Open cart"
              }
              title="Cart"
              className={`${ICON_BUTTON} relative`}
            >
              <BagIcon />
              {cart.itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-basket-terracotta text-xs font-medium text-white">
                  {cart.itemCount}
                </span>
              )}
            </button>

            {!isSignedIn && (
              <LinkButton href="/start" size="sm">
                Get started
              </LinkButton>
            )}
          </div>
        </div>

        {/* Phones get the search field on its own line rather than a cramped row */}
        <div className="pb-3 md:hidden">
          <SearchBar compact />
        </div>

        {/* Row two: the category nav, scrollable on narrow screens */}
        <nav className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 text-sm ${
                pathname === link.href
                  ? "font-semibold text-basket-green"
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
