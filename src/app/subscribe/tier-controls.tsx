"use client";

import { useTransition } from "react";
import { RadioCard } from "@/components/ui/radio-card";
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
    <div className="mt-4 flex flex-col items-center gap-3">
      <div className="grid w-full gap-2 sm:grid-cols-3">
        {tiers.map((t) => (
          <RadioCard
            key={t.slug}
            groupId="subscription-tier"
            selected={t.slug === currentSlug}
            disabled={isPending}
            onSelect={() => startTransition(() => changeTier(t.slug))}
          >
            <span className="block text-center">{t.name}</span>
          </RadioCard>
        ))}
      </div>
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
