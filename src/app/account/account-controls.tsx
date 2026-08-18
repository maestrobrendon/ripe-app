"use client";

import { useTransition } from "react";
import { TierSelect } from "@/components/tier-select";
import { changeSubscriptionTier, toggleSkipThisWeek } from "./actions";

export function TierControl({ tiers, currentTierSlug }: { tiers: { slug: string; name: string }[]; currentTierSlug: string }) {
  return <TierSelect tiers={tiers} value={currentTierSlug} onChange={changeSubscriptionTier} />;
}

export function SkipWeekButton({ isSkipped }: { isSkipped: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleSkipThisWeek())}
      className={`rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
        isSkipped ? "border-ripe-terracotta bg-ripe-terracotta-light text-ripe-terracotta-dark" : "border-border hover:bg-ripe-green-light"
      }`}
    >
      {isSkipped ? "Skipped — undo" : "Skip this week"}
    </button>
  );
}
