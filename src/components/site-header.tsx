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
            {isSignedIn ? (
              <LinkButton href="/account" variant="secondary" size="sm">
                Account
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="secondary" size="sm" className="hidden sm:inline-flex">
                  Sign in
                </LinkButton>
                <LinkButton href="/start" size="sm">
                  Get started
                </LinkButton>
              </>
            )}
            <button
              onClick={cart.openDrawer}
              aria-label="Open cart"
              className="tap-target relative rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-basket-green-light"
            >
              Cart
              {cart.itemCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-basket-terracotta text-xs font-medium text-white">
                  {cart.itemCount}
                </span>
              )}
            </button>
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
