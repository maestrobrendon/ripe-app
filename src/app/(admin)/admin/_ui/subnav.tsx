"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./kit";

/** Tabs for a section with several pages (Inventory, Delivery…). Exact match for the first, prefix for the rest. */
export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Section" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-black/6 pb-2 print:hidden">
      {items.map((i, n) => {
        const active = n === 0 ? path === i.href : path === i.href || path.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cx("flex h-9 shrink-0 items-center rounded-lg px-3 text-[13px] font-semibold", active ? "bg-carbon text-paper-white" : "text-carbon/65 hover:bg-soft-mist/70")}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
