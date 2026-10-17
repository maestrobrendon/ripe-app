"use client";

import { useEffect } from "react";

/**
 * Locks background scroll while a full-viewport overlay (sheet, drawer,
 * modal) is open. Without this the page behind it keeps scrolling/dragging
 * on mobile, which reads as broken scroll under an open overlay.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}
