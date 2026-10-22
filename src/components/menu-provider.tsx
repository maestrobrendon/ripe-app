"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MenuRecipe } from "@/lib/menu-types";

/*
 * The published menu for client components. Server pages load it with
 * getMenu() (src/lib/menu.ts) and wrap their client tree in MenuProvider;
 * components read it with useMenu().
 */

const MenuContext = createContext<MenuRecipe[] | null>(null);

export function MenuProvider({ menu, children }: { menu: MenuRecipe[]; children: ReactNode }) {
  return <MenuContext.Provider value={menu}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuRecipe[] {
  const menu = useContext(MenuContext);
  if (!menu) throw new Error("useMenu must be used inside <MenuProvider>");
  return menu;
}
