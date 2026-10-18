"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

/**
 * "Back", the way people expect it: to wherever they came from inside Basket,
 * or to `fallback` when they landed here from a link, a message or a fresh
 * tab (so it never throws them out of the site).
 */
export function BackButton({ fallback, label = "Back", className = "" }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  const go = () => {
    const fromHere = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin);
    if (fromHere && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button
      type="button"
      onClick={go}
      className={`-ml-2 inline-flex h-10 items-center gap-1 rounded-full pr-3.5 pl-2 text-[15px] font-semibold text-carbon transition-[background-color,transform] hover:bg-soft-mist active:scale-[0.97] ${className}`}
    >
      <Icon name="caretLeft" size={18} weight="bold" />
      {label}
    </button>
  );
}
