"use client";

/**
 * <FloatingDock /> — the account area's navigation (DESIGN_SYSTEM.md §12).
 * Floating, fully rounded, sticker-outlined. Mobile/tablet: a bottom pill,
 * 16px from the edge, the active tab widening to fit its label. Desktop
 * (≥1024px): the same component as a floating left rail, labels always
 * visible. A carbon pill (shared layoutId) slides between tabs either way.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Icon, type IconName } from "@/components/ui/icon";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { haptic, press, spring } from "@/lib/motion/tokens";

export type DockItem = {
  href: string;
  label: string;
  icon: IconName;
  match?: (pathname: string) => boolean;
  badge?: number;
};

const HIDE_AFTER = 120;
const DELTA = 6;

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function FloatingDock({ items, ariaLabel = "Account" }: { items: DockItem[]; ariaLabel?: string }) {
  const pathname = usePathname();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const { scrollY } = useScroll();
  const [hiddenOn, setHiddenOn] = useState<string | null>(null);
  const hidden = hiddenOn === pathname;
  const setHidden = (v: boolean) => setHiddenOn(v ? pathname : null);
  const [focusWithin, setFocusWithin] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (isDesktop) return;
    const prev = scrollY.getPrevious() ?? 0;
    const diff = y - prev;
    const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 24;
    if (atEnd || y < HIDE_AFTER) return setHidden(false);
    if (diff > DELTA) setHidden(true);
    else if (diff < -DELTA) setHidden(false);
  });

  const isActive = (item: DockItem) =>
    item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <motion.nav
      aria-label={ariaLabel}
      onFocus={() => setFocusWithin(true)}
      onBlur={() => setFocusWithin(false)}
      initial={{ y: 24, opacity: 0, scale: 0.96 }}
      animate={hidden && !focusWithin && !isDesktop ? { y: 120, opacity: 0, scale: 0.96 } : { y: 0, opacity: 1, scale: 1 }}
      transition={spring.sheet}
      className={cn(
        "fixed z-(--z-dock) border border-border bg-surface",
        // rounded-full is a pill only on the short, wide mobile bar (h-16).
        // The desktop rail stacks items into a tall, narrow column instead,
        // where the same 9999px radius clips into a near-circle around the
        // whole nav rather than rounding its corners — a fixed radius reads
        // as a rounded rectangle regardless of how tall the column gets.
        isDesktop
          ? "left-6 top-1/2 flex w-52 -translate-y-1/2 flex-col gap-1 rounded-3xl p-2"
          : "inset-x-0 mx-auto flex h-16 w-[min(100%-2rem,26rem)] items-stretch justify-between gap-1 rounded-full p-1.5",
      )}
      style={isDesktop ? undefined : { bottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
    >
      {items.map((item) => {
        const active = isActive(item);
        return (
          <div key={item.href} className={cn("relative", isDesktop ? "" : active ? "flex-[1.7]" : "flex-1")}>
            <motion.div layout transition={spring.indicator} className="h-full">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => !active && haptic(8)}
                className={cn(
                  "group relative flex h-full min-h-12 items-center gap-2 rounded-full outline-none transition-colors",
                  isDesktop ? "px-4 py-3" : "justify-center px-3",
                  active ? "text-paper-white" : "text-muted hover:bg-sky-wash",
                )}
              >
                {active && (
                  <motion.span
                    layoutId={`${ariaLabel}-dock-pill`}
                    transition={spring.indicator}
                    className="absolute inset-0 rounded-full bg-carbon"
                    aria-hidden
                  />
                )}

                <motion.span
                  className="relative inline-flex"
                  whileTap={{ scale: press.scale - 0.08 }}
                  animate={active ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                  transition={active ? { duration: 0.34, times: [0, 0.4, 1] } : spring.snappy}
                >
                  <Icon name={item.icon} size={22} weight={active ? "fill" : "regular"} />
                  <AnimatePresence>
                    {Boolean(item.badge) && !active && (
                      <motion.span
                        key={item.badge}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={spring.juicy}
                        className="absolute -right-2.5 -top-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border border-border bg-ember px-1 text-[11px] font-bold leading-none text-carbon tabular-nums"
                        aria-label={`${item.badge} items`}
                      >
                        {item.badge && item.badge > 9 ? "9+" : item.badge}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>

                <AnimatePresence initial={false} mode="popLayout">
                  {(active || isDesktop) && (
                    <motion.span
                      key="label"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={spring.snappy}
                      className="relative text-sm font-bold"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!active && !isDesktop && <span className="sr-only">{item.label}</span>}
              </Link>
            </motion.div>
          </div>
        );
      })}
    </motion.nav>
  );
}
