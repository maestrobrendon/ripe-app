"use client";

import { useCallback } from "react";
import { useCart } from "@/components/cart-provider";

/**
 * Runs an action and says how it went in the usual pop-up: `ok` when it
 * worked (if given), a plain error if it threw. Without this a failed server
 * action dropped the customer onto the full-page error screen.
 */
export function useActionToast() {
  const cart = useCart();
  return useCallback(
    async (fn: () => Promise<unknown>, ok?: string) => {
      try {
        await fn();
        if (ok) cart.announce(ok);
      } catch {
        cart.announce("That didn't go through. Check your connection and try again.", "error");
      }
    },
    [cart],
  );
}
