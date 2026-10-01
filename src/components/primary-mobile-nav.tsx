"use client";

import { AccountDock } from "@/components/account-dock";

/**
 * The bottom menu is for signed-in users only: they get the floating dock on
 * every page they can reach (Home, Recipes, Kachi, Account, and anything
 * else). A signed-out visitor gets no bottom menu at all; the header carries
 * their navigation. This is the only place that decides it.
 */
export function PrimaryMobileNav({ signedIn }: { signedIn: boolean }) {
  return signedIn ? <AccountDock /> : null;
}
