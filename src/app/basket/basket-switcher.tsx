"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { createBasket } from "./actions";

export type SwitcherBasket = { id: string; label: string };

/**
 * Multiple baskets are a subscriber perk: this chip row only ever renders for
 * a subscriber, since a non-subscriber is capped at their one free basket and
 * has nothing to switch between.
 */
export function BasketSwitcher({ baskets, activeId }: { baskets: SwitcherBasket[]; activeId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
      {baskets.map((b, i) => (
        <Link
          key={b.id}
          href={`/basket?b=${b.id}`}
          className={`tap-target shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
            b.id === activeId ? "border-carbon bg-carbon text-white" : "border-border hover:bg-sky-wash"
          }`}
        >
          {b.label || `Basket ${i + 1}`}
        </Link>
      ))}
      <button
        disabled={isPending}
        onClick={() => startTransition(() => createBasket())}
        className="tap-target flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-sm font-medium text-muted hover:border-carbon hover:text-carbon disabled:opacity-50"
      >
        <Icon name="plus" size={14} />
        New basket
      </button>
    </div>
  );
}
