"use client";

import { useState } from "react";
import { RadioCard } from "@/components/ui/radio-card";
import { DELIVERY_DAY_LABEL } from "@/lib/format";

const DAYS = ["MONDAY", "WEDNESDAY", "FRIDAY"] as const;

/** A form-submittable day picker: a hidden input mirrors the RadioCard selection. */
export function DeliveryDayField({ groupId }: { groupId: string }) {
  const [day, setDay] = useState<(typeof DAYS)[number]>(DAYS[0]);

  return (
    <div className="space-y-1.5">
      <input type="hidden" name="deliveryDay" value={day} />
      {DAYS.map((d) => (
        <RadioCard key={d} groupId={groupId} selected={day === d} onSelect={() => setDay(d)}>
          Deliver {DELIVERY_DAY_LABEL[d]}
        </RadioCard>
      ))}
    </div>
  );
}
