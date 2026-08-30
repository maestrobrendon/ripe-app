import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/weeks";

const WINDOW_LENGTH_DAYS = 4;

/**
 * The subscriber's current editable shopping window. Windows recur weekly: they
 * open at the start of the week and lock WINDOW_LENGTH_DAYS later, before
 * delivery. Once this week's window has closed, the upcoming week's window is
 * the one you edit. Created lazily here. A real deployment would open these on a
 * schedule.
 */
export async function getOrCreateCurrentWindow(userId: string) {
  const now = Date.now();
  let opensAt = currentWeekStart();
  let closesAt = new Date(opensAt);
  closesAt.setDate(closesAt.getDate() + WINDOW_LENGTH_DAYS);

  if (closesAt.getTime() <= now) {
    opensAt = new Date(opensAt);
    opensAt.setDate(opensAt.getDate() + 7);
    closesAt = new Date(opensAt);
    closesAt.setDate(closesAt.getDate() + WINDOW_LENGTH_DAYS);
  }

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
