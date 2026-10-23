"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { selectDelivery } from "./actions";

/**
 * Which basket Home is showing ("My basket", "For Mum"). Switching also
 * changes where the shop, recipes and Kachi add things. Only shown when
 * there's more than one; a new basket starts from the tab beside the hero.
 */
export function DeliverySwitcher({ deliveries, activeId }: { deliveries: { id: string; label: string; itemCount: number; oneOff?: boolean }[]; activeId: string }) {
  const [pending, start] = useTransition();
  const [going, setGoing] = useState<string | null>(null);

  return (
    <nav aria-label="Your baskets" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
      {deliveries.map((d) => {
        const on = d.id === activeId;
        return (
          <button
            key={d.id}
            type="button"
            aria-current={on ? "true" : undefined}
            disabled={pending}
            onClick={() => {
              if (on) return;
              setGoing(d.id);
              start(() => selectDelivery(d.id));
            }}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${on ? "border-carbon bg-carbon text-paper-white" : "border-hairline bg-surface"} ${going === d.id && pending ? "opacity-60" : ""}`}
          >
            {d.oneOff && <Icon name="box" size={14} weight="bold" />}
            {d.label}
            <span className={`rounded-full px-1.5 text-xs ${on ? "bg-paper-white/20" : "bg-soft-mist"}`}>{d.itemCount}</span>
          </button>
        );
      })}
    </nav>
  );
}
