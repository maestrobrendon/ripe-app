"use client";

import { useZone } from "@/components/zone-gate";
import { useSiteSettings } from "@/components/site-settings-provider";

export function AnnouncementBar() {
  const { zoneName, openPicker } = useZone();
  const { announcement } = useSiteSettings();

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-carbon px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      <span>{announcement.text}</span>
      <button onClick={openPicker} className="underline underline-offset-2">
        {zoneName ? `Delivering to ${zoneName}. Change` : "Set your delivery area"}
      </button>
    </div>
  );
}
