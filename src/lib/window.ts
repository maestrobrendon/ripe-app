import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/weeks";

const WINDOW_LENGTH_DAYS = 4;

/**
 * The subscriber's current shopping window. Windows recur weekly: they open at
 * the start of the week and lock WINDOW_LENGTH_DAYS later, before delivery.
 * Created lazily here. A real deployment would open these on a schedule.
 */
export async function getOrCreateCurrentWindow(userId: string) {
  const opensAt = currentWeekStart();
  const closesAt = new Date(opensAt);
  closesAt.setDate(closesAt.getDate() + WINDOW_LENGTH_DAYS);

  const existing = await prisma.shoppingWindow.findFirst({
    where: { userId, opensAt },
  });
  if (existing) return existing;

  return prisma.shoppingWindow.create({
    data: { userId, opensAt, closesAt, status: "OPEN" },
  });
}

export function windowState(window: { opensAt: Date; closesAt: Date; status: string }) {
  const now = Date.now();
  const msLeft = window.closesAt.getTime() - now;
  const locked = window.status === "LOCKED" || window.status === "FULFILLED" || msLeft <= 0;
  return {
    locked,
    skipped: window.status === "SKIPPED",
    msLeft: Math.max(0, msLeft),
    hoursLeft: Math.max(0, Math.floor(msLeft / 3_600_000)),
  };
}
