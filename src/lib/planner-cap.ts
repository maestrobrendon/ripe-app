import { cookies } from "next/headers";

// A guest gets a small number of free Produce Planner generations per day,
// tracked in a cookie rather than a User row since they don't have one yet —
// see the Recipes-by-tier addendum, Section 0. Signed-in accounts are never
// capped. Shared by the page (initial render) and the API route (each call).
export const GUEST_CAP_COOKIE = "planner_uses_today";
export const GUEST_FREE_USES_PER_DAY = 3;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function readGuestPlannerUseCount(): Promise<number> {
  const store = await cookies();
  const raw = store.get(GUEST_CAP_COOKIE)?.value ?? "";
  const [day, countStr] = raw.split(":");
  return day === todayKey() ? Number(countStr) || 0 : 0;
}

export async function readGuestPlannerUsesLeft(): Promise<number> {
  return Math.max(0, GUEST_FREE_USES_PER_DAY - (await readGuestPlannerUseCount()));
}

export function nextGuestPlannerCookieValue(currentCount: number): string {
  return `${todayKey()}:${currentCount + 1}`;
}
