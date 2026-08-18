"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type BasketItemView = {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  imageEmoji: string;
  memberPrice: number;
  marketPrice: number;
  quantity: number;
};

type BasketState = {
  items: BasketItemView[];
  memberSubtotal: number;
  marketSubtotal: number;
  deliveryDay: string | null;
};

type BasketContextValue = BasketState & {
  isOpen: boolean;
  isSignedIn: boolean;
  loadingProductId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  setQuantity: (product: { id: string; slug: string; name: string; unit: string; imageEmoji: string; memberPrice: number; marketPrice: number }, quantity: number) => Promise<void>;
  refresh: () => Promise<void>;
  itemCount: number;
};

const BasketContext = createContext<BasketContextValue | null>(null);

export function BasketProvider({
  children,
  initial,
  isSignedIn,
}: {
  children: React.ReactNode;
  initial: BasketState;
  isSignedIn: boolean;
}) {
  const [state, setState] = useState<BasketState>(initial);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const router = useRouter();

  const setQuantity: BasketContextValue["setQuantity"] = useCallback(
    async (product, quantity) => {
      if (!isSignedIn) {
        router.push("/subscribe");
        return;
      }
      setLoadingProductId(product.id);
      const previous = state;

      const nextItems =
        quantity <= 0
          ? state.items.filter((i) => i.productId !== product.id)
          : state.items.some((i) => i.productId === product.id)
          ? state.items.map((i) => (i.productId === product.id ? { ...i, quantity } : i))
          : [
              ...state.items,
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                unit: product.unit,
                imageEmoji: product.imageEmoji,
                memberPrice: product.memberPrice,
                marketPrice: product.marketPrice,
                quantity,
              },
            ];

      const memberSubtotal = nextItems.reduce((s, i) => s + i.memberPrice * i.quantity, 0);
      const marketSubtotal = nextItems.reduce((s, i) => s + i.marketPrice * i.quantity, 0);
      setState({ ...state, items: nextItems, memberSubtotal, marketSubtotal });
      if (quantity > 0) setIsOpen(true);

      try {
        const res = await fetch("/api/basket/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id, quantity }),
        });
        if (!res.ok) throw new Error("Failed to update basket");
        const data = (await res.json()) as BasketState;
        setState(data);
      } catch {
        setState(previous);
      } finally {
        setLoadingProductId(null);
      }
    },
    [state, isSignedIn, router]
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/basket");
    if (!res.ok) return;
    const data = (await res.json()) as BasketState;
    setState(data);
  }, []);

  const itemCount = useMemo(() => state.items.reduce((s, i) => s + i.quantity, 0), [state.items]);

  const value: BasketContextValue = {
    ...state,
    isOpen,
    isSignedIn,
    loadingProductId,
    openDrawer: () => setIsOpen(true),
    closeDrawer: () => setIsOpen(false),
    setQuantity,
    refresh,
    itemCount,
  };

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error("useBasket must be used within BasketProvider");
  return ctx;
}
