"use client";

import { useSyncExternalStore } from "react";

/** SSR-safe media query subscription. Returns `serverValue` during SSR/hydration. */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

const noopSubscribe = () => () => {};

/** true on the client after hydration, false on the server. For portals. */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
