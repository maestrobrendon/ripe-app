"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Whether the visitor asked for reduced motion, safe to branch render output on.
 *
 * Motion's `useReducedMotion` reads matchMedia during the first client render,
 * so a component that renders differently with it hydrates against server HTML
 * that assumed no preference, and React throws a mismatch. This reports `false`
 * on the server and through hydration, then switches to the real value right
 * after, and follows the setting if it changes.
 */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
