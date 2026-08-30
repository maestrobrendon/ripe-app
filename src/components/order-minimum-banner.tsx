"use client";

import { formatNaira } from "@/lib/format";
import { ORDER_MINIMUM, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { useZone } from "@/components/zone-gate";

export function OrderMinimumBanner() {
  const { zoneName, openPicker } = useZone();

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ripe-green px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      <span>
        Orders start at {formatNaira(ORDER_MINIMUM)}. Free delivery over {formatNaira(FREE_DELIVERY_THRESHOLD)}.
      </span>
      <button onClick={openPicker} className="underline underline-offset-2">
        {zoneName ? `Delivering to ${zoneName}. Change` : "Set your delivery area"}
      </button>
    </div>
  );
}
