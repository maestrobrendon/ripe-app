"use client";

import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { AccountDock } from "@/components/account-dock";

/**
 * One menu design per visitor state, everywhere: a signed-in user gets the
 * floating dock on every page they can reach (Home, Recipes, Kachi, Account,
 * and anything else), never the flush tab bar. A signed-out visitor keeps
 * the flush tab bar. Never both at once, and never the dock restyled or
 * re-implemented per page — this is the only place that decides which one
 * renders.
 */
export function PrimaryMobileNav({ signedIn }: { signedIn: boolean }) {
  if (!signedIn) return <MobileBottomNav signedIn={false} />;

  return <AccountDock />;
}
