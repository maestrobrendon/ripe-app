"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type DestinationBasket = { id: string; label: string };
export type Destination = { type: "cart" } | { type: "basket"; basketId: string; label: string };

export type AddToast = {
  productId: string;
  productName: string;
  quantity: number;
  destination: Destination;
  destinationLabel: string;
};

type Ctx = {
  signedIn: boolean;
  destination: Destination;
  baskets: DestinationBasket[];
  setDestination: (d: Destination) => void;
  toast: AddToast | null;
  announceAdd: (t: AddToast) => void;
  dismissToast: () => void;
};

const DestinationContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "ripe_destination";
const CART: Destination = { type: "cart" };

/**
 * "Shopping into" destination (Basket vs. Cart addendum, Section 1). Default
 * is Cart, and it resets to Cart on each new browser session by design — kept
 * in sessionStorage rather than a cookie so it clears itself with no server
 * plumbing needed, and never leaks between devices or accounts.
 */
export function DestinationProvider({
  signedIn,
  baskets,
  children,
}: {
  signedIn: boolean;
  baskets: DestinationBasket[];
  children: React.ReactNode;
}) {
  const [destination, setDestinationState] = useState<Destination>(CART);
  const [toast, setToast] = useState<AddToast | null>(null);

  useEffect(() => {
    // One-time hydration read from sessionStorage (unavailable during SSR,
    // hence why this can't be the useState initializer) — the same pattern
    // as ZoneProvider's dismissed-banner check.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Destination;
      if (parsed.type === "cart") setDestinationState(parsed);
      else if (parsed.type === "basket" && baskets.some((b) => b.id === parsed.basketId)) {
        setDestinationState(parsed);
      }
    } catch {
      // sessionStorage unavailable (private mode, etc.) — stay on Cart.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Only meant to run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDestination = useCallback((d: Destination) => {
    setDestinationState(d);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {
      // Non-fatal: destination just won't persist across a refresh this session.
    }
  }, []);

  const announceAdd = useCallback((t: AddToast) => setToast(t), []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <DestinationContext.Provider
      value={{ signedIn, destination, baskets, setDestination, toast, announceAdd, dismissToast }}
    >
      {children}
    </DestinationContext.Provider>
  );
}

export function useDestination() {
  const ctx = useContext(DestinationContext);
  if (!ctx) throw new Error("useDestination must be used within a DestinationProvider");
  return ctx;
}
