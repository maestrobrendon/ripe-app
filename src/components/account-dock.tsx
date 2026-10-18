"use client";

import { FloatingDock, type DockItem } from "@/components/ui/floating-dock";
import { useCart } from "@/components/cart-provider";

/**
 * The one menu for every signed-in page, always labelled: Home (this week's
 * order), Shop, Recipes, Orders, Me. Kachi is "Ask Kachi" in the header and on
 * Home and Recipes, where the questions come up.
 */
export function AccountDock() {
  const cart = useCart();
  const items: DockItem[] = [
    { href: "/basket", label: "Home", icon: "home", match: (p) => p.startsWith("/basket") || p.startsWith("/checkout"), flightTarget: true, badge: cart.items.length },
    { href: "/shop", label: "Shop", icon: "shop", match: (p) => p.startsWith("/shop") || p.startsWith("/products") || p.startsWith("/search") },
    { href: "/recipes", label: "Recipes", icon: "recipes", match: (p) => p.startsWith("/recipes") },
    { href: "/orders", label: "Orders", icon: "box", match: (p) => p.startsWith("/orders") },
    { href: "/account", label: "Me", icon: "account", match: (p) => p.startsWith("/account") || p.startsWith("/subscribe") },
  ];

  return <FloatingDock items={items} ariaLabel="Primary" />;
}
