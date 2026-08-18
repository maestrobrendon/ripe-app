"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBasket } from "@/components/basket-provider";

const NAV_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/basket", label: "Basket" },
  { href: "/assistant", label: "Trained assistant" },
  { href: "/about", label: "About" },
];

export function SiteHeader({ userName }: { userName: string | null }) {
  const pathname = usePathname();
  const basket = useBasket();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-xl font-semibold tracking-tight text-ripe-green">
          Ripe
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${
                pathname === link.href ? "font-medium text-ripe-green" : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {userName ? (
            <Link href="/account" className="hidden text-sm text-muted hover:text-foreground sm:inline">
              {userName}
            </Link>
          ) : (
            <Link
              href="/subscribe"
              className="hidden rounded-full bg-ripe-green px-4 py-2 text-sm font-medium text-white hover:bg-ripe-green-dark sm:inline-block"
            >
              Subscribe
            </Link>
          )}
          <button
            onClick={basket.openDrawer}
            className="relative rounded-full border border-border px-3 py-2 text-sm hover:bg-ripe-green-light"
          >
            Basket
            {basket.itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ripe-terracotta text-xs font-medium text-white">
                {basket.itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
