"use client";

import { useTransition } from "react";
import { changeTier, cancelSubscription } from "./actions";

export function TierControls({
  tiers,
  currentSlug,
}: {
  tiers: { slug: string; name: string }[];
  currentSlug: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <select
        defaultValue={currentSlug}
        disabled={isPending}
        onChange={(e) => startTransition(() => changeTier(e.target.value))}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      >
        {tiers.map((t) => (
          <option key={t.slug} value={t.slug}>{t.name}</option>
        ))}
      </select>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => cancelSubscription())}
        className="text-xs text-muted underline"
      >
        Cancel subscription
      </button>
    </div>
  );
}
