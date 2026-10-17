"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  unit: string;
  orderUnit: string;
  minOrderQty: number;
  stepQty: number;
  imageEmoji: string;
  cloudinaryPublicId: string | null;
  memberPrice: number;
  standardPrice: number;
  quantity: number;
};

export type CartSnapshot = {
  items: CartLine[];
  subtotal: number;
  standardSubtotal: number;
  memberSubtotal: number;
  savingsIfMember: number;
  itemCount: number;
  isSubscriber: boolean;
  /** On a plan that includes delivery (Member Plus). */
  freeDelivery: boolean;
  /** The customer's area fee. */
  deliveryFee: number;
  /** Cart value for free delivery (a site setting). */
  freeDeliveryThreshold: number;
};

export type AddableProduct = {
  id: string;
  slug: string;
  name: string;
  unit: string;
  orderUnit: string;
  minOrderQty: number;
  stepQty: number;
  imageEmoji: string;
  cloudinaryPublicId?: string | null;
  memberPrice: number;
  standardPrice: number;
  /** Shown, but staff marked it out of stock: it can't be added right now. */
  soldOut?: boolean;
};

type CartContextValue = CartSnapshot & {
  isOpen: boolean;
  loadingProductId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  setQuantity: (product: AddableProduct, quantity: number) => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function recompute(items: CartLine[], who: Pick<CartSnapshot, "isSubscriber" | "freeDelivery" | "deliveryFee" | "freeDeliveryThreshold">): CartSnapshot {
  const { isSubscriber } = who;
  const standardSubtotal = items.reduce((s, l) => s + l.standardPrice * l.quantity, 0);
  const memberSubtotal = items.reduce((s, l) => s + l.memberPrice * l.quantity, 0);
  return {
    items,
    standardSubtotal,
    memberSubtotal,
    subtotal: isSubscriber ? memberSubtotal : standardSubtotal,
    savingsIfMember: standardSubtotal - memberSubtotal,
    itemCount: items.reduce((s, l) => s + l.quantity, 0),
    ...who,
  };
}

export function CartProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: CartSnapshot;
}) {
  const [state, setState] = useState<CartSnapshot>(initial);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  const setQuantity: CartContextValue["setQuantity"] = useCallback(
    async (product, quantity) => {
      setLoadingProductId(product.id);
      const previous = state;

      const nextItems =
        quantity <= 0
          ? state.items.filter((i) => i.productId !== product.id)
          : state.items.some((i) => i.productId === product.id)
          ? state.items.map((i) =>
              i.productId === product.id ? { ...i, quantity } : i,
            )
          : [
              ...state.items,
              {
                productId: product.id,
                slug: product.slug,
                name: product.name,
                unit: product.unit,
                orderUnit: product.orderUnit,
                minOrderQty: product.minOrderQty,
                stepQty: product.stepQty,
                imageEmoji: product.imageEmoji,
                cloudinaryPublicId: product.cloudinaryPublicId ?? null,
                memberPrice: product.memberPrice,
                standardPrice: product.standardPrice,
                quantity,
              },
            ];

      setState(recompute(nextItems, { isSubscriber: state.isSubscriber, freeDelivery: state.freeDelivery, deliveryFee: state.deliveryFee, freeDeliveryThreshold: state.freeDeliveryThreshold }));
      if (quantity > 0) setIsOpen(true);

      try {
        const res = await fetch("/api/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id, quantity }),
        });
        if (!res.ok) throw new Error("Failed to update cart");
        setState((await res.json()) as CartSnapshot);
      } catch {
        setState(previous);
      } finally {
        setLoadingProductId(null);
      }
    },
    [state],
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/cart");
    if (!res.ok) return;
    setState((await res.json()) as CartSnapshot);
  }, []);

  const value: CartContextValue = useMemo(
    () => ({
      ...state,
      isOpen,
      loadingProductId,
      openDrawer: () => setIsOpen(true),
      closeDrawer: () => setIsOpen(false),
      setQuantity,
      refresh,
    }),
    [state, isOpen, loadingProductId, setQuantity, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
