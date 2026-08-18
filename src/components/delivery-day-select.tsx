"use client";

import { useTransition } from "react";
import type { DeliveryDay } from "@/generated/prisma/enums";

const OPTIONS: { value: DeliveryDay; label: string }[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "FRIDAY", label: "Friday" },
];

export function DeliveryDaySelect({
  value,
  onChange,
}: {
  value: DeliveryDay;
  onChange: (day: DeliveryDay) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={value}
      disabled={isPending}
      onChange={(e) => startTransition(() => onChange(e.target.value as DeliveryDay))}
      className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-60"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
