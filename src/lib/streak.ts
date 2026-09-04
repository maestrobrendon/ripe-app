import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/weeks";
import { nextMilestoneAfter, weekStartOf, type StreakView } from "@/lib/streak-config";

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
    prisma.order.findMany({ where: { userId }, select: { createdAt: true } }),
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

  const longest = Math.max(prev?.longestStreakWeeks ?? 0, streak);
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
