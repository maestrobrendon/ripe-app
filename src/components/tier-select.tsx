"use client";

import { useTransition } from "react";

export function TierSelect({
  tiers,
  value,
  onChange,
}: {
  tiers: { slug: string; name: string }[];
  value: string;
  onChange: (tierSlug: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={value}
      disabled={isPending}
      onChange={(e) => startTransition(() => onChange(e.target.value))}
      className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
    >
      {tiers.map((t) => (
        <option key={t.slug} value={t.slug}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
