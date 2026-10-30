import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/weeks";
import { nextMilestoneAfter, STREAK_MILESTONES, weekStartOf, type StreakView } from "@/lib/streak-config";
import { grantCredit } from "@/lib/credit";

export type { StreakView } from "@/lib/streak-config";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Consecutive weeks with a completed order (one-off or subscription). A week
 * with no order does NOT break the streak if the subscriber used skip/pause;
 * only an ordinary order-less week breaks it. Walks back from the current week.
 */
export async function recomputeStreak(userId: string): Promise<StreakView> {
  const thisWeek = currentWeekStart();

  const [orders, skippedWindows, prev] = await Promise.all([
    // Ties to completed orders, not logins: paidAt is the completion mark.
    prisma.order.findMany({ where: { userId, paidAt: { not: null } }, select: { createdAt: true } }),
    prisma.shoppingWindow.findMany({
      where: { userId, status: "SKIPPED" },
      select: { opensAt: true },
    }),
    prisma.streakStatus.findUnique({ where: { userId } }),
  ]);

  const orderWeeks = new Set(orders.map((o) => weekStartOf(o.createdAt).getTime()));
  const skippedWeeks = new Set(skippedWindows.map((w) => weekStartOf(w.opensAt).getTime()));
  const lastOrderDate = orders.reduce<Date | null>(
    (latest, o) => (!latest || o.createdAt > latest ? o.createdAt : latest),
    null,
  );

  let streak = 0;
  let cursor = thisWeek.getTime();
  while (true) {
    if (orderWeeks.has(cursor)) {
      streak += 1;
      cursor -= WEEK_MS;
      continue;
    }
    if (skippedWeeks.has(cursor)) {
      cursor -= WEEK_MS; // bridge, no increment
      continue;
    }
    break;
  }

  // The best run ever, not just the current one: consecutive weeks with an
  // order, skipped weeks bridging, anywhere in their history.
  let best = 0;
  let run = 0;
  const allWeeks = [...new Set([...orderWeeks, ...skippedWeeks])].sort((x, y) => x - y);
  for (let i = 0; i < allWeeks.length; i++) {
    const contiguous = i > 0 && allWeeks[i] - allWeeks[i - 1] === WEEK_MS;
    if (!contiguous) run = 0;
    if (orderWeeks.has(allWeeks[i])) run += 1;
    best = Math.max(best, run);
  }
  const longest = Math.max(prev?.longestStreakWeeks ?? 0, streak, best);
  const nextMilestone = nextMilestoneAfter(streak);

  await prisma.streakStatus.upsert({
    where: { userId },
    update: {
      currentStreakWeeks: streak,
      longestStreakWeeks: longest,
      lastQualifyingOrderDate: lastOrderDate,
      nextMilestoneWeeks: nextMilestone,
    },
    create: {
      userId,
      currentStreakWeeks: streak,
      longestStreakWeeks: longest,
      lastQualifyingOrderDate: lastOrderDate,
      nextMilestoneWeeks: nextMilestone,
    },
  });

  return {
    currentStreakWeeks: streak,
    longestStreakWeeks: longest,
    lastQualifyingOrderDate: lastOrderDate,
    nextMilestoneWeeks: nextMilestone,
  };
}

export type WeekDot = { label: string; state: "done" | "skipped" | "missed" | "now" };

export type StreakDetails = StreakView & {
  /** The last eight weeks, oldest first; the last one is this week. */
  weeks: WeekDot[];
  thisWeekDone: boolean;
  /** Credit paid just now for a milestone reached, to celebrate once. */
  justRewarded: { weeks: number; amount: number } | null;
};

/**
 * The streak as the account shows it: the count, the last eight weeks as
 * dots, and any milestone credit not yet paid, paid now (once each, by the
 * StreakReward row's unique key).
 */
export async function streakDetails(userId: string): Promise<StreakDetails> {
  const view = await recomputeStreak(userId);
  const thisWeek = currentWeekStart().getTime();
  const since = new Date(thisWeek - 7 * WEEK_MS);
  const [orders, skipped, paidRewards] = await Promise.all([
    prisma.order.findMany({ where: { userId, paidAt: { not: null }, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.shoppingWindow.findMany({ where: { userId, status: "SKIPPED", opensAt: { gte: since } }, select: { opensAt: true } }),
    prisma.streakReward.findMany({ where: { userId }, select: { weeks: true } }),
  ]);
  const done = new Set(orders.map((o) => weekStartOf(o.createdAt).getTime()));
  const skip = new Set(skipped.map((w) => weekStartOf(w.opensAt).getTime()));
  const weeks: WeekDot[] = Array.from({ length: 8 }, (_, i) => {
    const t = thisWeek - (7 - i) * WEEK_MS;
    const label = new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).replace("Sept", "Sep");
    return { label, state: done.has(t) ? "done" : skip.has(t) ? "skipped" : t === thisWeek ? "now" : "missed" };
  });

  // Milestones reached at any point (the longest streak) that pay credit and haven't yet.
  let justRewarded: StreakDetails["justRewarded"] = null;
  const have = new Set(paidRewards.map((r) => r.weeks));
  for (const m of STREAK_MILESTONES) {
    if (!m.credit || m.weeks > view.longestStreakWeeks || have.has(m.weeks)) continue;
    try {
      await prisma.streakReward.create({ data: { userId, weeks: m.weeks, amount: m.credit } });
    } catch {
      continue; // Paid by a request that got here first.
    }
    await grantCredit({ userId, amount: m.credit, reason: `${m.label} reward`, staffName: "Streak" });
    justRewarded = { weeks: m.weeks, amount: m.credit };
  }

  return { ...view, weeks, thisWeekDone: done.has(thisWeek), justRewarded };
}

export type Badge = { id: string; label: string; detail: string; emoji: string; earned: boolean };

/** Small things to collect: the first basket, streaks, gifts, feedback, invites. */
export async function badgesFor(userId: string, longestStreak: number): Promise<Badge[]> {
  const [orders, saved, gifts, feedback, invites] = await Promise.all([
    prisma.order.count({ where: { userId, paidAt: { not: null } } }),
    prisma.savedRecipe.count({ where: { userId } }),
    prisma.gift.count({ where: { senderId: userId, status: { in: ["ACTIVE", "CLAIMED"] } } }),
    prisma.feedback.count({ where: { userId } }),
    prisma.creditRecord.count({ where: { userId, kind: "CREDIT", reason: { startsWith: "Invite reward" } } }),
  ]);
  return [
    { id: "first", label: "First basket", detail: "Your first delivery", emoji: "🧺", earned: orders > 0 },
    { id: "streak-4", label: "On a roll", detail: "4 weeks in a row", emoji: "🔥", earned: longestStreak >= 4 },
    { id: "streak-12", label: "In season", detail: "12 weeks in a row", emoji: "🌱", earned: longestStreak >= 12 },
    { id: "streak-26", label: "Half a year", detail: "26 weeks in a row", emoji: "🌳", earned: longestStreak >= 26 },
    { id: "streak-52", label: "A whole year", detail: "52 weeks in a row", emoji: "🏆", earned: longestStreak >= 52 },
    { id: "recipes", label: "Recipe collector", detail: "5 recipes saved", emoji: "📖", earned: saved >= 5 },
    { id: "gift", label: "Generous", detail: "Gave someone a basket", emoji: "🎁", earned: gifts > 0 },
    { id: "feedback", label: "Heard", detail: "Told us how we're doing", emoji: "💬", earned: feedback > 0 },
    { id: "invite", label: "Good company", detail: "A friend joined from your invite", emoji: "🤝", earned: invites > 0 },
  ];
}
