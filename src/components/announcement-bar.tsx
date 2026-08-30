"use client";

import { useZone } from "@/components/zone-gate";

export function AnnouncementBar() {
  const { zoneName, openPicker } = useZone();

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ripe-green px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      <span>Freshly selected fruit and vegetables, delivered across Lagos.</span>
      <button onClick={openPicker} className="underline underline-offset-2">
        {zoneName ? `Delivering to ${zoneName}. Change` : "Set your delivery area"}
      </button>
    </div>
  );
}
