"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { Icon } from "@/components/ui/icon";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { gesture, projectMomentum, rubberband } from "@/lib/motion/tokens";

/*
 * The one sheet. On a phone it rises from the bottom on a spring and is
 * dragged the way an iPhone sheet is:
 *
 * - Down, it follows the finger 1:1.
 * - Up, past where it rests, it stretches with iOS's rubber-band curve: the
 *   further you pull, the less it follows, and it can never pass a ceiling.
 * - On release, the flick's momentum is projected forward (Apple's
 *   deceleration maths) and that landing point decides: past about a third
 *   of the sheet it closes, otherwise it springs home. Either way the spring
 *   starts at the finger's speed, so there's no seam between drag and motion.
 * - It can be grabbed mid-spring and carries on from where it is.
 *
 * From lg up, callers can ask for a centred dialog instead, which scales in
 * from the middle. The backdrop dims the page so the task has focus; tapping
 * it, Escape, or the close button all dismiss.
 */

const SHEET = { type: "spring" as const, bounce: 0.12, duration: 0.38 };
const DIALOG = { type: "spring" as const, bounce: 0, duration: 0.28 };
/** How far the sheet can stretch upwards, at most. Filled underneath, so no gap shows. */
const STRETCH = 120;

type Drag = { id: number; startY: number; from: number; active: boolean; samples: { t: number; y: number }[] };

/** The finger's speed (px/s) over its last ~100ms, or 0 if it had stopped before letting go. */
function fingerVelocity(samples: Drag["samples"], now: number): number {
  const recent = samples.filter((s) => now - s.t <= 100);
  if (recent.length < 2) return 0;
  const a = recent[0];
  const b = recent[recent.length - 1];
  return b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
}

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

  // A number while dragged; the open/close animations leave it as a percentage ("0%").
  const y = useMotionValue<number | string>(0);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  /** Where the sheet is now, in pixels. */
  const yPx = () => {
    const v = y.get();
    if (typeof v === "number") return v;
    const n = parseFloat(v) || 0;
    return v.endsWith("%") ? (n / 100) * (sheet.current?.offsetHeight ?? 0) : n;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (dialog || e.button !== 0) return;
    // Start from where it is on screen, even mid-spring, and stop that spring.
    y.stop();
    const at = yPx();
    // Already stretched up: undo the curve, so the finger picks it up without a jump.
    const from = at >= 0 ? at : -((-at * STRETCH) / (0.55 * (STRETCH + at)));
    drag.current = { id: e.pointerId, startY: e.clientY, from, active: false, samples: [{ t: e.timeStamp, y: e.clientY }] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const moved = e.clientY - d.startY;
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    if (d.samples.length > 8) d.samples.shift();
    if (!d.active) {
      // A small dead zone first, so a tap on a button stays a tap.
      if (Math.abs(moved) < gesture.dragIntent) return;
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const raw = d.from + moved;
    y.set(raw >= 0 ? raw : -rubberband(-raw, STRETCH));
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    const at = yPx();
    // Measured from the finger itself: the animation library only sees the last frame or two.
    const velocity = fingerVelocity(d.samples, e.timeStamp);
    const height = sheet.current?.offsetHeight ?? 400;
    // Where the flick would come to rest, not just where the finger let go.
    const landing = at + projectMomentum(velocity);
    if (at > 0 && velocity > -100 && landing > height * gesture.dismissFraction) onClose();
    // Stretched up past the top, it just settles back; otherwise it leaves at the finger's speed.
    else animate(y, 0, { ...SHEET, velocity: at < 0 ? 0 : velocity });
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
            ref={sheet}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={
              dialog
                ? "absolute top-1/2 left-1/2 flex max-h-[85svh] w-[min(32rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)] ring-1 ring-black/5"
                : // The second shadow is a solid strip of sheet below it, so stretching up never shows a gap.
                  "absolute inset-x-0 bottom-0 flex max-h-[88svh] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.3),0_120px_0_0_var(--color-surface)]"
            }
            style={dialog ? { paddingBottom: "env(safe-area-inset-bottom)" } : { paddingBottom: "env(safe-area-inset-bottom)", y }}
            initial={dialog ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            animate={dialog ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={dialog ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
            transition={dialog ? DIALOG : SHEET}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div className={`relative shrink-0 px-5 pt-3 pb-3 lg:px-6 ${dialog ? "" : "touch-none select-none"}`}>
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
