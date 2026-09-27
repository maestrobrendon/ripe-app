"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { AccountPromo } from "@/lib/account-promo";

const DISMISSED_KEY = "basket:dismissedAccountPromos";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getServerSnapshot() {
  return false;
}

export function PromoBanner({ promo }: { promo: AccountPromo }) {
  // localStorage only exists client-side, so the server snapshot always shows
  // the banner; useSyncExternalStore settles the real, possibly-dismissed
  // state on the client without a manual setState-in-effect render.
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed().includes(promo.id),
    getServerSnapshot,
  );

  if (dismissed) return null;

  const dismiss = () => {
    try {
      const next = Array.from(new Set([...readDismissed(), promo.id]));
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("storage"));
    } catch {
      // Private browsing or blocked storage: dismissing just won't persist.
    }
  };

  return (
    <div className="mt-6 flex items-center justify-between gap-3 rounded-card border border-border bg-sky-wash px-4 py-3 text-sm text-carbon">
      <p className="min-w-0">
        {promo.message}
        {promo.href && promo.ctaLabel && (
          <Link href={promo.href} className="ml-2 font-semibold underline">
            {promo.ctaLabel}
          </Link>
        )}
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="tap-target shrink-0 rounded-full p-1 text-carbon/70 hover:text-carbon"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
