"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RollingNumber } from "@/components/ui/rolling-number";
import { spring } from "@/lib/motion/tokens";
import { haptic } from "@/lib/haptics";
import { formatNaira } from "@/lib/format";

export type StreakCardData = {
  current: number;
  longest: number;
  /** 0 to 1, from the last milestone to the next. */
  progress: number;
  next: { weeks: number; reward: string; toGo: number } | null;
  weeks: { label: string; state: "done" | "skipped" | "missed" | "now" }[];
  thisWeekDone: boolean;
  justRewarded: { weeks: number; amount: number } | null;
  milestones: { weeks: number; label: string; reward: string; reached: boolean }[];
  badges: { id: string; label: string; detail: string; emoji: string; earned: boolean }[];
};

/** A small ring that fills toward the next milestone. */
function Ring({ progress, size = 64, stroke = 7, children }: { progress: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const still = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: still ? c * (1 - progress) : c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.02, Math.min(1, progress))) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

function Dots({ weeks, big = false }: { weeks: StreakCardData["weeks"]; big?: boolean }) {
  return (
    <ol className="flex items-end justify-between gap-1.5" aria-label="The last eight weeks">
      {weeks.map((w, i) => (
        <li key={w.label} className="flex flex-1 flex-col items-center gap-1.5">
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring.juicy, delay: 0.1 + i * 0.05 }}
            className={`grid place-items-center rounded-full ${big ? "h-8 w-8 text-[14px]" : "h-5 w-full max-w-5 text-[10px]"} ${
              w.state === "done"
                ? "bg-[#ff8a3d] text-paper-white"
                : w.state === "skipped"
                  ? "bg-paper-white/30 text-current"
                  : w.state === "now"
                    ? "border-2 border-dashed border-current"
                    : "bg-current/12"
            }`}
            title={`${w.label}: ${w.state === "done" ? "basket" : w.state === "skipped" ? "skipped (kept the streak)" : w.state === "now" ? "this week" : "no basket"}`}
          >
            {w.state === "done" ? "🔥" : w.state === "skipped" ? "–" : ""}
          </motion.span>
          {big && <span className="text-[10px] whitespace-nowrap text-carbon/50">{w.label}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * The streak on the Me page: weeks in a row with a basket, the ring filling
 * toward the next reward, and the last eight weeks. Tapping it opens the
 * whole thing: milestones, badges, and how it works.
 */
export function StreakCard({ data }: { data: StreakCardData }) {
  const [open, setOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(Boolean(data.justRewarded));
  const still = useReducedMotion();

  useEffect(() => {
    if (!data.justRewarded) return;
    haptic("success");
    const t = window.setTimeout(() => setCelebrate(false), 6000);
    return () => window.clearTimeout(t);
  }, [data.justRewarded]);

  const line = data.current === 0
    ? "Have a basket this week to start your streak"
    : data.thisWeekDone
      ? "This week's done. See you next week."
      : "Confirm this week's basket to keep it going";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic("selection");
          setOpen(true);
        }}
        className="relative mt-4 w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#2b1406] to-[#5a2a0c] p-4 text-left text-[#ffd9b8] transition-transform active:scale-[0.99]"
        aria-label={`${data.current}-week streak. Open your streak.`}
      >
        {celebrate && data.justRewarded && (
          <motion.p
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-3 rounded-xl bg-[#ff8a3d] px-3 py-2 text-[13px] font-semibold text-paper-white"
          >
            🎉 {data.justRewarded.weeks} weeks in a row! {formatNaira(data.justRewarded.amount)} credit added.
          </motion.p>
        )}
        <span className="flex items-center gap-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold tracking-[0.06em] text-[#ffb37a] uppercase">Your streak</span>
            <span className="mt-1 flex items-baseline gap-2 text-paper-white">
              <motion.span
                aria-hidden
                animate={still || data.current === 0 ? undefined : { scale: [1, 1.12, 1], rotate: [0, -4, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="text-[30px] leading-none"
              >
                {data.current > 0 ? "🔥" : "🌱"}
              </motion.span>
              <RollingNumber value={data.current} className="text-[36px] leading-none font-semibold tracking-[-0.04em] tabular-nums" />
              <span className="text-[15px] font-medium text-[#ffd9b8]">{data.current === 1 ? "week" : "weeks"}</span>
            </span>
            <span className="mt-1.5 block text-[13px] leading-snug">{line}</span>
          </span>
          <Ring progress={data.progress} size={68}>
            <span className="text-center text-[10px] leading-tight font-semibold text-paper-white">
              {data.next ? (
                <>
                  {data.next.toGo}
                  <br />
                  to go
                </>
              ) : (
                "Max"
              )}
            </span>
          </Ring>
        </span>
        <span className="mt-4 block">
          <Dots weeks={data.weeks} />
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Your streak" desktopDialog>
        <div className="text-center">
          <motion.p initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={spring.juicy} className="text-[56px] leading-none" aria-hidden>
            {data.current > 0 ? "🔥" : "🌱"}
          </motion.p>
          <p className="mt-2 text-[40px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
            {data.current} {data.current === 1 ? "week" : "weeks"}
          </p>
          <p className="mt-1.5 text-[14px] text-carbon/60">in a row with a basket · best {data.longest}</p>
        </div>

        {data.next && (
          <div className="mt-6 rounded-2xl bg-[#fff1e6] p-4">
            <p className="text-[14px]">
              <b className="font-semibold">
                {data.next.toGo} more {data.next.toGo === 1 ? "week" : "weeks"}
              </b>{" "}
              for {data.next.reward.toLowerCase()}
            </p>
            <span className="mt-3 block h-2.5 overflow-hidden rounded-full bg-[#ff8a3d]/20">
              <motion.span
                className="block h-full rounded-full bg-[#ff8a3d]"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(Math.max(0.04, data.progress) * 100)}%` }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              />
            </span>
          </div>
        )}

        <h3 className="mt-7 text-[13px] font-semibold tracking-[0.02em] text-carbon/55 uppercase">The last eight weeks</h3>
        <div className="mt-3 text-carbon">
          <Dots weeks={data.weeks} big />
        </div>

        <h3 className="mt-7 text-[13px] font-semibold tracking-[0.02em] text-carbon/55 uppercase">Rewards</h3>
        <ul className="mt-2 divide-y divide-hairline">
          {data.milestones.map((m) => (
            <li key={m.weeks} className="flex items-center gap-3 py-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold ${m.reached ? "bg-[#ff8a3d] text-paper-white" : "bg-black/5 text-carbon/45"}`}>{m.weeks}</span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{m.label}</b>
                <span className="block text-[13px] text-carbon/60">{m.reward}</span>
              </span>
              {m.reached && <span className="text-[13px] font-semibold text-[#c2560c]">Earned</span>}
            </li>
          ))}
        </ul>

        <h3 className="mt-7 text-[13px] font-semibold tracking-[0.02em] text-carbon/55 uppercase">
          Badges · {data.badges.filter((b) => b.earned).length} of {data.badges.length}
        </h3>
        <ul className="mt-3 grid grid-cols-3 gap-2.5">
          {data.badges.map((b, i) => (
            <motion.li
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.smooth, delay: 0.05 * i }}
              className={`flex flex-col items-center rounded-2xl px-2 py-3 text-center ${b.earned ? "bg-[#fff1e6]" : "bg-black/[0.03]"}`}
            >
              <span className={`text-[28px] leading-none ${b.earned ? "" : "opacity-30 grayscale"}`} aria-hidden>
                {b.earned ? b.emoji : "🔒"}
              </span>
              <b className={`mt-1.5 text-[12px] leading-tight font-semibold ${b.earned ? "" : "text-carbon/45"}`}>{b.label}</b>
              <span className="mt-0.5 text-[11px] leading-tight text-carbon/50">{b.detail}</span>
            </motion.li>
          ))}
        </ul>

        <p className="mt-7 rounded-2xl bg-black/[0.03] p-4 text-[13px] leading-relaxed text-carbon/65">
          A week counts when you have a basket that week. Skipping a week from your basket keeps the streak going; a week with no basket and no skip starts it again.
        </p>
        <div className="mt-5 grid gap-2.5 pb-2 sm:grid-cols-2">
          <Link href="/basket" className="flex h-12 items-center justify-center rounded-full bg-carbon text-[15px] font-semibold text-paper-white">
            {data.thisWeekDone ? "See your basket" : "Confirm this week"}
          </Link>
          <Link href="/gift" className="flex h-12 items-center justify-center rounded-full bg-black/5 text-[15px] font-semibold">
            🎁 Gift a basket
          </Link>
        </div>
      </BottomSheet>
    </>
  );
}
