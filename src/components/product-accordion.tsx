"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { spring } from "@/lib/motion/tokens";

export type AccordionSection = {
  title: string;
  body: string | null;
  /** Optional link rendered under the body, for example into Recipes. */
  link?: { href: string; label: string };
};

/** Collapsed-by-default accordion for the product detail page. Multiple rows can be open at once. */
export function ProductAccordion({ sections }: { sections: AccordionSection[] }) {
  const visible = sections.filter((s) => s.body);
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (visible.length === 0) return null;

  const toggle = (title: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });

  return (
    <div className="divide-y divide-border border-y border-border">
      {visible.map((s) => {
        const isOpen = open.has(s.title);
        return (
          <div key={s.title} className="py-1">
            <button
              type="button"
              onClick={() => toggle(s.title)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between py-2 text-left text-sm font-medium"
            >
              {s.title}
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={spring.snappy}
                className="text-muted"
              >
                <CaretDown size={16} aria-hidden />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={spring.smooth}
                  className="overflow-hidden"
                >
                  <div className="pb-3 text-sm text-muted">
                    <p>{s.body}</p>
                    {s.link && (
                      <Link href={s.link.href} className="mt-2 inline-block font-medium text-carbon underline">
                        {s.link.label}
                      </Link>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
