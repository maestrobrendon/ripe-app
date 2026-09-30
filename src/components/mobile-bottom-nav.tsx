"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Icon, type IconName } from "@/components/ui/icon";
import { haptic, press, spring } from "@/lib/motion/tokens";

type Tab = {
  href: string;
  label: string;
  icon: IconName;
  match: (pathname: string) => boolean;
};

/**
 * Four top-level destinations. Cart is its own screen but still lives under
 * Home here, so it never lights up a different tab than the basket hub does.
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
      className="fixed inset-x-0 bottom-0 z-(--z-dock) flex border-t border-border bg-surface sm:hidden"
      style={{ height: "var(--mobile-nav-h)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            onClick={() => !active && haptic(8)}
            className="tap-target relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"
          >
            {active && (
              <motion.span
                layoutId="mobile-nav-active"
                transition={spring.indicator}
                className="absolute inset-x-2 inset-y-1 -z-10 rounded-2xl bg-sky-wash"
                aria-hidden
              />
            )}
            <motion.span
              className="relative inline-flex"
              whileTap={{ scale: press.scale }}
              animate={active ? { scale: [1, 1.14, 1] } : { scale: 1 }}
              transition={active ? { duration: 0.34, times: [0, 0.4, 1] } : spring.snappy}
            >
              <Icon name={tab.icon} size={22} weight={active ? "fill" : "regular"} className={active ? "text-carbon" : "text-muted"} />
            </motion.span>
            <span className={active ? "text-carbon" : "text-muted"}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
