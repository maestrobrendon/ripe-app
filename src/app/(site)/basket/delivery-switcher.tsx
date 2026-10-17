"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { selectDelivery } from "./actions";
import { NewDeliverySheet, type DayOption } from "./new-delivery-sheet";

/**
 * Which delivery Home is showing, when there's more than one. Switching also
 * changes where the shop, recipes and Kachi add things.
 */
export function DeliverySwitcher({
  deliveries,
  activeId,
  canAddMore,
  member,
  dayOptions,
}: {
  deliveries: { id: string; label: string; itemCount: number }[];
  activeId: string;
  canAddMore: boolean;
  member: boolean;
  dayOptions: DayOption[];
}) {
  const [pending, start] = useTransition();
  const [going, setGoing] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <nav aria-label="Your deliveries" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
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
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${on ? "border-carbon bg-carbon text-paper-white" : "border-border bg-surface"} ${going === d.id && pending ? "opacity-60" : ""}`}
          >
            {d.label}
            <span className={`rounded-full px-1.5 text-xs ${on ? "bg-paper-white/20" : "bg-soft-mist"}`}>{d.itemCount}</span>
          </button>
        );
      })}
      {canAddMore ? (
        <button type="button" onClick={() => setNewOpen(true)} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-sm font-semibold">
          <Icon name="plus" size={14} weight="bold" />
          Another
        </button>
      ) : (
        <Link href={member ? "/subscribe?reason=basket-limit" : "/subscribe?reason=free-basket-used"} className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-sm font-semibold">
          <Icon name="plus" size={14} weight="bold" />
          Another
        </Link>
      )}
      <NewDeliverySheet open={newOpen} onClose={() => setNewOpen(false)} dayOptions={dayOptions} />
    </nav>
  );
}
