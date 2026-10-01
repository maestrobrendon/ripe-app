import { STREAK_MILESTONES, type StreakView } from "@/lib/streak-config";
import { CountUp } from "@/components/motion/count-up";
import { StreakRing } from "@/components/motion/streak-ring";

/** Fraction of the way from the previous milestone to the next one, for the ring. */
function ringProgress(view: StreakView): number {
  if (view.nextMilestoneWeeks == null) return 1;
  const prev = [...STREAK_MILESTONES].reverse().find((m) => m.weeks <= view.currentStreakWeeks)?.weeks ?? 0;
  const span = view.nextMilestoneWeeks - prev;
  return span > 0 ? (view.currentStreakWeeks - prev) / span : 1;
}

function weeksLabel(n: number): string {
  return `${n}-week streak`;
}

function nextRewardLine(view: StreakView): string | null {
  if (view.nextMilestoneWeeks == null) return null;
  const m = STREAK_MILESTONES.find((x) => x.weeks === view.nextMilestoneWeeks);
  if (!m) return null;
  const toGo = m.weeks - view.currentStreakWeeks;
  return `${toGo} more ${toGo === 1 ? "week" : "weeks"} for ${m.reward.toLowerCase()}`;
}

/** Compact inline counter for headers and rails. */
export function StreakBadge({ view }: { view: StreakView }) {
  if (view.currentStreakWeeks === 0) {
    return <span className="text-sm text-muted">Order this week to start a streak</span>;
  }
  return (
    <span className="text-sm">
      <span className="font-semibold">{weeksLabel(view.currentStreakWeeks)}</span>
      {nextRewardLine(view) && <span className="text-muted"> · {nextRewardLine(view)}</span>}
    </span>
  );
}

/** Fuller card for the account dashboard and basket stat row. */
export function StreakCard({ view }: { view: StreakView }) {
  const line = nextRewardLine(view);
  return (
    <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
      <StreakRing progress={ringProgress(view)} label={`${view.currentStreakWeeks} week streak`} />
      <div className="min-w-0">
        <p className="text-xs text-muted">Weekly streak</p>
        <p className="text-2xl font-semibold">
          <CountUp value={view.currentStreakWeeks} format="weeks" />
        </p>
        <p className="text-xs text-muted">
          {view.currentStreakWeeks === 0
            ? "A completed order each week builds your streak. Skips do not break it."
            : line
            ? line
            : `Longest run: ${view.longestStreakWeeks} weeks`}
        </p>
      </div>
    </div>
  );
}
