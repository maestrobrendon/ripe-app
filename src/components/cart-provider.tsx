"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion/tokens";

/*
 * What the customer is filling, on every page: a guest's cart, or a signed-in
 * customer's delivery (this week's order). The server decides which (see
 * lib/cart.ts); components just call setQuantity. Every change answers with a
 * short toast: where it went, or why it couldn't be added, and a removal can
 * be undone from the toast. On Home, the page refreshes quietly after changes
 * so its suggestions and recipe counts follow the order.
 */

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
  soldOut?: boolean;
  limited?: boolean;
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
  /** Order value for free delivery (a site setting). */
  freeDeliveryThreshold: number;
  /** "cart" for a guest; "delivery" for a signed-in customer. */
  container: "cart" | "delivery";
  deliveryId: string | null;
  /** "your Wednesday order". */
  deliveryLabel: string | null;
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

type Notice = { id: number; tone: "ok" | "error"; text: string; showView: boolean; action?: { label: string; run: () => void } };

type CartContextValue = CartSnapshot & {
  isOpen: boolean;
  loadingProductId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Put this product at exactly `quantity` (0 removes it). */
  setQuantity: (product: AddableProduct, quantity: number) => Promise<void>;
  /** The quantity of a product already in what's being filled. */
  quantityOf: (productId: string) => number;
  refresh: () => Promise<void>;
  /** Show a toast from elsewhere (bulk adds from recipes, Kachi). */
  announce: (text: string, tone?: "ok" | "error") => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function recompute(items: CartLine[], base: CartSnapshot): CartSnapshot {
  const standardSubtotal = items.reduce((s, l) => s + l.standardPrice * l.quantity, 0);
  const memberSubtotal = items.reduce((s, l) => s + l.memberPrice * l.quantity, 0);
  return {
    ...base,
    items,
    standardSubtotal,
    memberSubtotal,
    subtotal: base.isSubscriber ? memberSubtotal : standardSubtotal,
    savingsIfMember: standardSubtotal - memberSubtotal,
    itemCount: items.reduce((s, l) => s + l.quantity, 0),
  };
}

export function CartProvider({ children, initial }: { children: React.ReactNode; initial: CartSnapshot }) {
  const [state, setState] = useState<CartSnapshot>(initial);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const refreshTimer = useRef<number | undefined>(undefined);
  const router = useRouter();
  const pathname = usePathname();

  // The server is the truth: whenever the page is re-rendered on the server
  // (a refresh after Kachi, a recipe or Home changed the order), take its view.
  const initialKey = JSON.stringify([initial.deliveryId, initial.items.map((i) => [i.productId, i.quantity]), initial.isSubscriber]);
  const lastKey = useRef(initialKey);
  useEffect(() => {
    if (initialKey === lastKey.current) return;
    lastKey.current = initialKey;
    setState(initial);
  }, [initialKey, initial]);

  const announce = useCallback((text: string, tone: "ok" | "error" = "ok", showView = tone === "ok", action?: Notice["action"]) => {
    window.clearTimeout(timer.current);
    setNotice({ id: Date.now(), tone, text, showView, action });
    timer.current = window.setTimeout(() => setNotice(null), tone === "error" ? 5000 : action ? 5000 : 3200);
  }, []);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(refreshTimer.current);
    },
    [],
  );

  // Home shows things worked out from the order on the server (suggestions,
  // what recipes still need); refresh it once the taps settle.
  const settle = useCallback(() => {
    if (pathname !== "/basket") return;
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => router.refresh(), 900);
  }, [pathname, router]);

  const setQuantityRef = useRef<CartContextValue["setQuantity"] | null>(null);

  const setQuantity: CartContextValue["setQuantity"] = useCallback(
    async (product, quantity) => {
      setLoadingProductId(product.id);
      const previous = state;
      const before = state.items.find((i) => i.productId === product.id)?.quantity ?? 0;
      const nextItems =
        quantity <= 0
          ? state.items.filter((i) => i.productId !== product.id)
          : before > 0
          ? state.items.map((i) => (i.productId === product.id ? { ...i, quantity } : i))
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
                soldOut: product.soldOut ?? false,
                limited: false,
              },
            ];
      setState(recompute(nextItems, state));

      try {
        const res = await fetch("/api/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id, quantity }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "That didn't go through. Try again.");
        setState(data as CartSnapshot);
        const where = (data as CartSnapshot).deliveryLabel ?? "your cart";
        if (before === 0 && quantity > 0) announce(`${product.name} added to ${where}`);
        else if (quantity <= 0 && before > 0)
          announce(`${product.name} removed`, "ok", false, { label: "Undo", run: () => void setQuantityRef.current?.(product, before) });
        settle();
      } catch (e) {
        setState(previous);
        announce(e instanceof Error ? e.message : "That didn't go through. Try again.", "error");
      } finally {
        setLoadingProductId(null);
      }
    },
    [state, announce, settle],
  );
  useEffect(() => {
    setQuantityRef.current = setQuantity;
  }, [setQuantity]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/cart");
    if (!res.ok) return;
    setState((await res.json()) as CartSnapshot);
  }, []);

  const quantityOf = useCallback((productId: string) => state.items.find((i) => i.productId === productId)?.quantity ?? 0, [state.items]);

  const value: CartContextValue = useMemo(
    () => ({
      ...state,
      isOpen,
      loadingProductId,
      openDrawer: () => setIsOpen(true),
      closeDrawer: () => setIsOpen(false),
      setQuantity,
      quantityOf,
      refresh,
      announce: (text: string, tone: "ok" | "error" = "ok") => announce(text, tone),
    }),
    [state, isOpen, loadingProductId, setQuantity, quantityOf, refresh, announce],
  );

  const signedIn = state.container === "delivery";
  return (
    <CartContext.Provider value={value}>
      {children}
      <div className="cart-toast pointer-events-none fixed inset-x-0 z-(--z-toast) flex justify-center px-4" data-signed-in={signedIn || undefined} aria-live="polite">
        <AnimatePresence>
          {notice && (
            <motion.div
              key={notice.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={spring.snappy}
              role={notice.tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-4 py-2.5 text-sm shadow-lg ${notice.tone === "error" ? "bg-ember text-white" : "bg-carbon text-white"}`}
            >
              <span className="min-w-0">{notice.text}</span>
              {notice.action && (
                <button
                  type="button"
                  className="shrink-0 font-semibold text-mint-pop"
                  onClick={() => {
                    notice.action?.run();
                    setNotice(null);
                  }}
                >
                  {notice.action.label}
                </button>
              )}
              {notice.showView &&
                (signedIn ? (
                  <Link href="/basket" className="shrink-0 font-semibold text-mint-pop underline-offset-2 hover:underline" onClick={() => setNotice(null)}>
                    View
                  </Link>
                ) : (
                  <button type="button" className="shrink-0 font-semibold text-mint-pop" onClick={() => { setNotice(null); setIsOpen(true); }}>
                    View
                  </button>
                ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
