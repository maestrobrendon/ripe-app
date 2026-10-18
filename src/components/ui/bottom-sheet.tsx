"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

/*
 * The one sheet. On a phone it rises from the bottom on a spring, follows the
 * finger 1:1 when dragged down, and dismisses on a firm flick or a long pull
 * (velocity decides, not just distance); anything less springs back. From lg
 * up, callers can ask for a centred dialog instead, which scales in from the
 * middle. The backdrop dims the page so the task has focus; tapping it,
 * Escape, or the close button all dismiss.
 */

const SHEET = { type: "spring" as const, bounce: 0.12, duration: 0.38 };
const DIALOG = { type: "spring" as const, bounce: 0, duration: 0.28 };

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  desktopDialog = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** From lg up, open as a centred dialog instead of a full-width sheet. */
  desktopDialog?: boolean;
}) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const dialog = desktopDialog && isDesktop;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useBodyScrollLock(open);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-70">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-carbon/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={
              dialog
                ? "absolute top-1/2 left-1/2 flex max-h-[85svh] w-[min(32rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] ring-1 ring-black/5"
                : "absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.3)]"
            }
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={dialog ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            animate={dialog ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={dialog ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
            transition={dialog ? DIALOG : SHEET}
            drag={dialog ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            dragListener={!dialog}
            onDragEnd={dialog ? undefined : onDragEnd}
          >
            <div className="relative shrink-0 px-5 pt-3 pb-3 lg:px-6">
              {!dialog && <span aria-hidden className="absolute top-2 left-1/2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-black/15" />}
              <div className={`flex items-center justify-between gap-3 ${dialog ? "pt-3" : "pt-4"}`}>
                <h2 className="text-[20px] leading-tight font-semibold tracking-[-0.015em]">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-carbon/70 transition-[background-color,transform] hover:bg-black/[0.1] active:scale-90"
                >
                  <Icon name="close" size={15} weight="bold" />
                </button>
              </div>
            </div>
            {/* Scrolling content doesn't drag the sheet: only the header area does on a phone. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-6 lg:px-6" onPointerDown={(e) => e.stopPropagation()}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
