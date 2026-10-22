"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** A thin line under the header while the phone has no connection, so a tap that "does nothing" has a reason. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-(--z-header) bg-carbon px-4 py-2 text-center text-[13px] text-paper-white">
      You&apos;re offline. Changes won&apos;t save until you&apos;re back online.
    </div>
  );
}
