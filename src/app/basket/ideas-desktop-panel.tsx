"use client";

import type { StreakView } from "@/lib/streak-config";
import { StreakBadge } from "@/components/streak-badge";
import { IdeasPanel } from "./ideas-panel";

/** Desktop's always-visible right column. Mobile gets the same content in a sheet instead. */
export function IdeasDesktopPanel({
  signature,
  locked,
  streak,
  showStreak = true,
}: {
  signature: string;
  locked: boolean;
  streak: StreakView;
  showStreak?: boolean;
}) {
  return (
    <aside className="hidden rounded-card border border-border bg-surface p-4 shadow-sm lg:sticky lg:top-24 lg:block lg:self-start">
      <h2 className="text-sm font-semibold">Ideas</h2>
      <p className="mt-1 text-xs text-muted">
        Reads your basket and goal. Tap a chip to apply it, no navigation.
      </p>

      {showStreak && (
        <div className="mt-3 border-t border-border pt-3">
          <StreakBadge view={streak} />
        </div>
      )}

      <div className="mt-4">
        <IdeasPanel signature={signature} locked={locked} />
      </div>
    </aside>
  );
}
