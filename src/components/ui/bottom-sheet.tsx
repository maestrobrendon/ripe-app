"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Mobile bottom sheet: backdrop tap, Escape, and a drag-down gesture all
 * dismiss it. Desktop callers render their own inline panel instead of this
 * (see Ideas), so this only needs to work well as a phone-width overlay.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setDragY(delta);
  };
  const onTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 90) onClose();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-70">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-carbon/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 flex max-h-[85svh] flex-col overflow-hidden rounded-t-card-lg border-t border-border bg-surface"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 200ms ease-out",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="flex shrink-0 items-center justify-between border-b border-border px-4 pb-3 pt-2"
        >
          <span className="mx-auto absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
          <p className="pt-2 text-sm font-semibold">{title}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="tap-target -mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
