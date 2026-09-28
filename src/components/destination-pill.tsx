"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useDestination, type Destination } from "@/components/destination-provider";
import { useCart } from "@/components/cart-provider";
import { setBasketItemQuantity, createBasket } from "@/app/basket/actions";

function labelFor(destination: Destination) {
  return destination.type === "cart" ? "Cart" : destination.label;
}

/** The "Shopping into: X" pill (Basket vs. Cart addendum, Section 1). Signed-in only. */
export function DestinationPill() {
  const { signedIn, destination, baskets, setDestination } = useDestination();
  const [open, setOpen] = useState(false);

  if (!signedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-sky-wash px-3 py-1.5 text-xs font-medium text-carbon"
      >
        <Icon name="cart" size={13} strokeWidth={2} />
        Shopping into: <span className="font-semibold">{labelFor(destination)}</span>
        <Icon name="edit" size={11} strokeWidth={2} className="text-muted" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Shopping into">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setDestination({ type: "cart" });
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between rounded-card border px-4 py-3 text-left text-sm font-medium ${
              destination.type === "cart" ? "border-carbon bg-sky-wash" : "border-border"
            }`}
          >
            Cart
            {destination.type === "cart" && <Icon name="check" size={16} />}
          </button>
          {baskets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setDestination({ type: "basket", basketId: b.id, label: b.label });
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-card border px-4 py-3 text-left text-sm font-medium ${
                destination.type === "basket" && destination.basketId === b.id ? "border-carbon bg-sky-wash" : "border-border"
              }`}
            >
              {b.label}
              {destination.type === "basket" && destination.basketId === b.id && <Icon name="check" size={16} />}
            </button>
          ))}
          <form action={createBasket} className="mt-2">
            <button
              type="submit"
              className="block w-full rounded-card border border-dashed border-border px-4 py-3 text-center text-sm font-medium text-carbon"
            >
              + New basket
            </button>
          </form>
        </div>
      </BottomSheet>
    </>
  );
}

/**
 * The chevron beside a product's Add button (Section 1: "a small chevron
 * beside it opens the same destination sheet for a one-off override"). Picks
 * a destination for THIS add only — it never changes the shared "shopping
 * into" default.
 */
export function DestinationOverrideChevron({ onPick }: { onPick: (destination: Destination) => void }) {
  const { signedIn, baskets } = useDestination();
  const [open, setOpen] = useState(false);

  if (!signedIn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Choose where this goes"
        className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted hover:bg-sky-wash"
      >
        ⌄
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Add to">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              onPick({ type: "cart" });
              setOpen(false);
            }}
            className="flex w-full items-center rounded-card border border-border px-4 py-3 text-left text-sm font-medium"
          >
            Cart
          </button>
          {baskets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onPick({ type: "basket", basketId: b.id, label: b.label });
                setOpen(false);
              }}
              className="flex w-full items-center rounded-card border border-border px-4 py-3 text-left text-sm font-medium"
            >
              {b.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

async function removeFrom(destination: Destination, productId: string) {
  if (destination.type === "cart") {
    await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: 0 }),
    });
  } else {
    await setBasketItemQuantity(destination.basketId, productId, 0);
  }
}

export async function addToDestination(destination: Destination, productId: string, quantity: number) {
  if (destination.type === "cart") {
    await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity }),
    });
  } else {
    await setBasketItemQuantity(destination.basketId, productId, quantity);
  }
}

/** Global "Added to X" toast with a Change action, shown from anywhere a card adds an item. */
export function DestinationToast() {
  const { toast, dismissToast, setDestination, baskets, signedIn } = useDestination();
  const cart = useCart();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!signedIn || !toast) return null;

  const moveTo = (destination: Destination) => {
    setPickerOpen(false);
    startTransition(async () => {
      await removeFrom(toast.destination, toast.productId);
      await addToDestination(destination, toast.productId, toast.quantity);
      await cart.refresh();
      setDestination(destination);
      dismissToast();
    });
  };

  return (
    <>
      <div
        className="fixed inset-x-4 z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full bg-carbon px-4 py-3 text-sm text-white shadow-lg sm:inset-x-auto sm:right-6"
        style={{ bottom: "calc(var(--mobile-nav-h) + 16px)" }}
      >
        <span className="min-w-0 truncate">
          Added to <span className="font-semibold">{toast.destinationLabel}</span>
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setPickerOpen(true)}
          className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
        >
          Change
        </button>
      </div>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Move to">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => moveTo({ type: "cart" })}
            className="flex w-full items-center rounded-card border border-border px-4 py-3 text-left text-sm font-medium"
          >
            Cart
          </button>
          {baskets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => moveTo({ type: "basket", basketId: b.id, label: b.label })}
              className="flex w-full items-center rounded-card border border-border px-4 py-3 text-left text-sm font-medium"
            >
              {b.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
