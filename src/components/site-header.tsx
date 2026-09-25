"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { HeaderSearch } from "@/components/header-search";
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
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-heading-sm tracking-tight text-basket-green">
            {SITE_NAME}
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm ${
                  pathname === link.href ? "font-medium text-basket-green" : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <HeaderSearch />
            <LinkButton
              href={isSignedIn ? "/account" : "/login"}
              aria-label={isSignedIn ? "Your account" : "Sign in"}
              variant="secondary"
              size="sm"
            >
              {isSignedIn ? "Account" : "Sign in"}
            </LinkButton>
            <button
              onClick={cart.openDrawer}
              aria-label="Open cart"
              className="relative rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-basket-green-light"
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

        {/* Mobile: nav scrolls horizontally under the bar */}
        <nav className="mt-3 flex gap-4 overflow-x-auto lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 text-sm ${
                pathname === link.href ? "font-medium text-basket-green" : "text-muted"
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
