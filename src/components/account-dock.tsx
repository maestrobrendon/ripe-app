"use client";

import { FloatingDock, type DockItem } from "@/components/ui/floating-dock";

/**
 * The one menu for every signed-in page: Basket (home), Recipes, Kachi,
 * Account. No count badge here; the item count lives only on the header's
 * Cart button.
 */
export function AccountDock() {
  const items: DockItem[] = [
    {
      href: "/basket",
      label: "Basket",
      icon: "home",
      match: (p) => p.startsWith("/basket") || p.startsWith("/cart") || p.startsWith("/orders"),
    },
    { href: "/recipes", label: "Recipes", icon: "recipes", match: (p) => p.startsWith("/recipes") },
    { href: "/assistant", label: "Kachi", icon: "assistant", match: (p) => p.startsWith("/assistant") },
    { href: "/account", label: "Account", icon: "account", match: (p) => p.startsWith("/account") },
  ];

  return <FloatingDock items={items} ariaLabel="Primary" />;
}
