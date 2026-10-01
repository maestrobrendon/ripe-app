"use client";

import { useTransition } from "react";
import { RadioCard } from "@/components/ui/radio-card";
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
    <div className="flex flex-col gap-2 sm:flex-row">
      {OPTIONS.map((o) => (
        <RadioCard
          key={o.value}
          groupId="delivery-day-select"
          selected={value === o.value}
          disabled={isPending}
          onSelect={() => startTransition(() => onChange(o.value))}
        >
          {o.label}
        </RadioCard>
      ))}
    </div>
  );
}
