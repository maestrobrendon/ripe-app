"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * A horizontal row of cards. On touch it's a native swipe with snap points;
 * with a pointer it gets previous/next buttons that page by what's visible,
 * and fade out at either end so there's never a button that does nothing.
 * The edges fade where cards run off, which says "there's more" on its own.
 */
export function Rail({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.85), behavior: "smooth" });
  };

  const fade = `${edges.start ? "#000" : "transparent"}, #000 2.5rem, #000 calc(100% - 2.5rem), ${edges.end ? "#000" : "transparent"}`;

  return (
    <div className={`group/rail relative ${className}`}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 outline-none [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: `linear-gradient(to right, ${fade})`, WebkitMaskImage: `linear-gradient(to right, ${fade})` }}
      >
        {children}
      </div>
      <RailButton dir={-1} hidden={edges.start} onClick={() => page(-1)} />
      <RailButton dir={1} hidden={edges.end} onClick={() => page(1)} />
    </div>
  );
}

function RailButton({ dir, hidden, onClick }: { dir: 1 | -1; hidden: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? "Show more" : "Show previous"}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden || undefined}
      className={`absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-surface/90 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)] backdrop-blur-md transition-[opacity,transform] duration-200 hover:scale-105 active:scale-95 [@media(hover:hover)]:flex ${
        dir === 1 ? "-right-3" : "-left-3"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <Icon name={dir === 1 ? "caretRight" : "caretLeft"} size={18} weight="bold" />
    </button>
  );
}
