"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart-provider";
import { Icon } from "@/components/ui/icon";

/**
 * The internal switcher inside the Home section of the bottom nav: Home (the
 * basket hub) and Cart (one-off items) are sub-views of the same top-level
 * tab, not separate destinations, so switching between them never changes
 * which bottom-nav icon is lit — see the nav-correction addendum, Section 1.
 */
export function HomeCartTabs({ homeHref }: { homeHref: string }) {
  const pathname = usePathname();
  const cart = useCart();
  const onCart = pathname.startsWith("/cart");

  return (
    <div className="mb-5 inline-flex rounded-full border border-border bg-surface p-1 sm:hidden">
      <Link
        href={homeHref}
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
          !onCart ? "bg-carbon text-white" : "text-muted hover:text-carbon"
        }`}
      >
        <Icon name="home" size={16} />
        Home
      </Link>
      <Link
        href="/cart"
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
          onCart ? "bg-carbon text-white" : "text-muted hover:text-carbon"
        }`}
      >
        <Icon name="cart" size={16} />
        Cart
        {cart.itemCount > 0 && (
          <span
            className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
              onCart ? "bg-white text-carbon" : "bg-ember text-white"
            }`}
          >
            {cart.itemCount}
          </span>
        )}
      </Link>
    </div>
  );
}
