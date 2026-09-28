import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { GOAL_LABEL } from "@/lib/format";

export type SavedPlanRow = {
  id: string;
  weekStart: Date;
  householdSize: number;
  goal: string | null;
  theme: string | null;
  itemCount: number;
};

/**
 * Free accounts only ever have one row (produce-plan-actions.ts prunes on
 * every save), so this reads the same way for both tiers — a subscriber's
 * history is just what naturally accumulates.
 */
export async function loadSavedProducePlans(user: CurrentUser): Promise<SavedPlanRow[]> {
  const rows = await prisma.producePlan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    householdSize: r.householdSize,
    goal: r.goal,
    theme: r.theme,
    itemCount: Array.isArray(r.items) ? r.items.length : 0,
  }));
}

export function SavedProducePlans({ plans, isSubscriber }: { plans: SavedPlanRow[]; isSubscriber: boolean }) {
  if (plans.length === 0) return null;

  return (
    <div className="mt-8 border-t border-border pt-6">
      <p className="text-sm font-semibold">{isSubscriber ? "Your saved plans" : "Your saved plan"}</p>
      <ul className="mt-3 space-y-2">
        {plans.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{p.theme ?? (p.goal ? GOAL_LABEL[p.goal] ?? p.goal : "Produce plan")}</span>{" "}
              <span className="text-muted">
                · {p.itemCount} items · for {p.householdSize} · saved{" "}
                {p.weekStart.toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {!isSubscriber && (
        <p className="mt-2 text-xs text-muted">
          Free accounts keep the latest plan only. Subscribe to keep a history.
        </p>
      )}
    </div>
  );
}
