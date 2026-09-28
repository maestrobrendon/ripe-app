"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

type Tab = {
  href: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
};

/**
 * Four top-level destinations. Cart and the basket hub are both "Home" here,
 * switched between with the in-page HomeCartTabs control, so neither route
 * ever lights up a different tab than Home — see the nav-correction addendum.
 */
function tabsFor(signedIn: boolean): Tab[] {
  return [
    {
      href: signedIn ? "/basket" : "/",
      label: "Home",
      icon: "home",
      match: (p) => p === "/" || p.startsWith("/basket") || p.startsWith("/cart"),
    },
    {
      href: "/recipes",
      label: "Recipes",
      icon: "recipes",
      match: (p) => p.startsWith("/recipes"),
    },
    {
      href: "/assistant",
      label: "Kachi",
      icon: "assistant",
      match: (p) => p.startsWith("/assistant"),
    },
    {
      href: signedIn ? "/account" : "/login?next=/account",
      label: "Account",
      icon: "account",
      match: (p) => p.startsWith("/account") || p.startsWith("/login") || p.startsWith("/signup"),
    },
  ];
}

export function MobileBottomNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const tabs = tabsFor(signedIn);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface sm:hidden"
      style={{ height: "var(--mobile-nav-h)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`tap-target flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
              active ? "text-carbon" : "text-muted"
            }`}
          >
            <Icon name={tab.icon} size={22} strokeWidth={active ? 2 : 1.5} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
