import { STREAK_MILESTONES, type StreakView } from "@/lib/streak-config";

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
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">Weekly streak</p>
      <p className="text-2xl font-semibold">
        {view.currentStreakWeeks} {view.currentStreakWeeks === 1 ? "week" : "weeks"}
      </p>
      <p className="text-xs text-muted">
        {view.currentStreakWeeks === 0
          ? "A completed order each week builds your streak. Skips do not break it."
          : line
          ? line
          : `Longest run: ${view.longestStreakWeeks} weeks`}
      </p>
    </div>
  );
}
