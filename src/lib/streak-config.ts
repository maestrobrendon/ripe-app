import { formatNaira } from "@/lib/format";

// Founder-tunable milestone rewards. Client-safe (no DB imports).
const DELIVERY_CREDIT_NAIRA = 1000;
const MILESTONE_26_VOUCHER_PCT = 5;
const MILESTONE_52_VOUCHER_PCT = 10;

export type Milestone = {
  weeks: number;
  label: string;
  reward: string;
  /** Whether reaching this milestone unlocks early seasonal access. */
  earlySeasonalAccess?: boolean;
};

export const STREAK_MILESTONES: Milestone[] = [
  {
    weeks: 4,
    label: "4-week streak",
    reward: `${formatNaira(DELIVERY_CREDIT_NAIRA)} delivery credit`,
  },
  {
    weeks: 12,
    label: "12-week streak",
    reward: "Early seasonal access this week, even on Base",
    earlySeasonalAccess: true,
  },
  {
    weeks: 26,
    label: "26-week streak",
    reward: `Streak badge and a ${MILESTONE_26_VOUCHER_PCT}% voucher`,
  },
  {
    weeks: 52,
    label: "52-week streak",
    reward: `Year badge and a ${MILESTONE_52_VOUCHER_PCT}% voucher`,
  },
];

export const EARLY_SEASONAL_WEEKS =
  STREAK_MILESTONES.find((m) => m.earlySeasonalAccess)?.weeks ?? 12;

export type StreakView = {
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  lastQualifyingOrderDate: Date | null;
  nextMilestoneWeeks: number | null;
};

export function weekStartOf(d: Date): Date {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday;
}

export function nextMilestoneAfter(weeks: number): number | null {
  return STREAK_MILESTONES.find((m) => m.weeks > weeks)?.weeks ?? null;
}

export function reachedMilestones(weeks: number): Milestone[] {
  return STREAK_MILESTONES.filter((m) => weeks >= m.weeks);
}

export function hasEarlySeasonalAccess(
  streakWeeks: number,
  tierSlug: string | null | undefined,
): boolean {
  return tierSlug === "premium" || streakWeeks >= EARLY_SEASONAL_WEEKS;
}
